import { createServer as createNetServer } from "node:net";
import { resolve } from "node:path";
import { createOpencodeClient, createOpencodeServer } from "@opencode-ai/sdk";
import { resolveDefaultModelId, resolveRequestedModelId, toOpenCodeModelIdentifier } from "./model-catalog.js";

type WorkerRequest = {
  question?: unknown;
  limit?: unknown;
  requestId?: unknown;
  model?: unknown;
};

type WorkerSource = {
  id: string;
  title: string;
  path: string | null;
  snippet: string;
  score: number | null;
  context: string | null;
};

type WorkerResponse = {
  ok: true;
  question: string;
  answer: string;
  sources: WorkerSource[];
};

type WorkerErrorCode =
  | "opencode_no_text_output"
  | "provider_quota_exceeded"
  | "provider_rate_limited"
  | "provider_auth_error"
  | "opencode_worker_failed";

type WorkerErrorResponse = {
  ok: false;
  error: string;
  details?: string[];
  code?: WorkerErrorCode;
  provider?: string;
};

type TextPart = {
  type: string;
  text?: string;
};

type WithOptionalData<T> = T | { data: T };

class StructuredWorkerError extends Error {
  response: WorkerErrorResponse;

  constructor(response: WorkerErrorResponse) {
    super(response.error);
    this.name = "StructuredWorkerError";
    this.response = response;
  }
}

const vaultRoot = resolve(process.env.VAULT_MIRROR_DIR || "/srv/vault-mirror");
const scopeRoot = resolve(process.cwd());
const promptHeartbeatMs = Number(process.env.OPENCODE_PROMPT_HEARTBEAT_MS || 15000);
const systemPrompt = [
  "You are answering questions from local journal/note files in the current working directory tree.",
  "Perform an exhaustive recursive inspection of the current working directory tree before answering.",
  "Use the available tools to inspect the actual files in this folder tree, not just the directory names.",
  "Prefer directly reading the most relevant notes instead of making shallow guesses from filenames.",
  "Base your answer only on file contents you actually inspected.",
  "Do not infer note dates or existence from folder names alone.",
  "For date-based questions, search for files whose names or contents match the requested date and inspect nearby relevant files when needed.",
  "For summary questions, synthesize across multiple relevant notes in the current folder tree if that improves the answer.",
  "Be thorough before concluding that information is missing.",
  "If the answer is present in a note, summarize it directly from that note.",
  "If the answer is not present in the files, say that clearly.",
  "Do not ask follow-up questions such as 'want me to check there?' because the current directory already defines the search scope."
].join(" ");

function readStdin(): Promise<WorkerRequest> {
  return new Promise((resolveInput, reject) => {
    const chunks: Buffer[] = [];

    process.stdin.on("data", (chunk) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    process.stdin.on("end", () => {
      try {
        const raw = Buffer.concat(chunks).toString("utf8");
        resolveInput(raw ? (JSON.parse(raw) as WorkerRequest) : {});
      } catch (error) {
        reject(error);
      }
    });
    process.stdin.on("error", reject);
  });
}

function previewQuestion(value: string) {
  const normalized = value.replace(/\s+/g, " ").trim();

  if (normalized.length <= 120) {
    return normalized;
  }

  return `${normalized.slice(0, 119)}…`;
}

function logProgress(requestId: string, message: string) {
  process.stderr.write(`[worker:${requestId}] ${message}\n`);
}

function writeJson(value: unknown) {
  return new Promise<void>((resolveWrite, reject) => {
    process.stdout.write(JSON.stringify(value), (error) => {
      if (error) {
        reject(error);
        return;
      }

      resolveWrite();
    });
  });
}

function extractAnswer(parts: unknown) {
  if (!Array.isArray(parts)) {
    throw new Error("OpenCode response did not include message parts.");
  }

  const text = (parts as TextPart[])
    .filter((part) => part.type === "text" && typeof part.text === "string")
    .map((part) => part.text?.trim() || "")
    .filter(Boolean)
    .join("\n\n")
    .trim();

  if (!text) {
    throw new Error("OpenCode response did not include any text output.");
  }

  return text;
}

function truncateDetail(value: string, maxLength = 240) {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 1)}…`;
}

function getPartString(part: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = part[key];

    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return null;
}

function summarizeResponseParts(parts: unknown) {
  if (!Array.isArray(parts)) {
    return [];
  }

  const details: string[] = [];
  let textPartCount = 0;
  let textCharacterCount = 0;

  for (const part of parts) {
    if (!part || typeof part !== "object") {
      continue;
    }

    const record = part as Record<string, unknown>;
    const partType = typeof record.type === "string" ? record.type : "unknown";

    if (partType === "text") {
      const text = typeof record.text === "string" ? record.text.trim() : "";

      if (text) {
        textPartCount += 1;
        textCharacterCount += text.length;
      }

      continue;
    }

    if (partType === "reasoning") {
      details.push("Reasoning generated.");
      continue;
    }

    if (partType === "tool") {
      const toolName = getPartString(record, ["toolName", "title", "name"]) ?? "tool";
      const status = getPartString(record, ["status", "state"]);
      details.push(status ? `Tool used: ${toolName} (${status}).` : `Tool used: ${toolName}.`);
      continue;
    }

    if (partType === "step-start") {
      const title = getPartString(record, ["title", "name"]);
      details.push(title ? `Step started: ${title}.` : "Step started.");
      continue;
    }

    if (partType === "step-finish") {
      const title = getPartString(record, ["title", "name"]);
      details.push(title ? `Step finished: ${title}.` : "Step finished.");
      continue;
    }

    if (partType === "snapshot") {
      details.push("Snapshot produced.");
      continue;
    }

    if (partType === "patch") {
      details.push("Patch produced.");
      continue;
    }

    if (partType === "agent") {
      const agentName = getPartString(record, ["name", "agent"]);
      details.push(agentName ? `Agent activity: ${agentName}.` : "Agent activity recorded.");
    }
  }

  if (textPartCount > 0) {
    details.unshift(
      `Text output generated (${textPartCount} part${textPartCount === 1 ? "" : "s"}, ${textCharacterCount} chars).`
    );
  }

  return details;
}

function classifyWorkerError(error: unknown, details: string[]): WorkerErrorResponse {
  const rawMessage = error instanceof Error ? error.message : String(error ?? "Unknown error");
  const compactMessage = rawMessage.replace(/\s+/g, " ").trim();
  const lowerMessage = compactMessage.toLowerCase();
  const nextDetails = [...details];

  const appendProviderMessage = () => {
    if (!compactMessage) {
      return;
    }

    nextDetails.push(`Provider message: ${truncateDetail(compactMessage)}`);
  };

  if (
    /insufficient credits|quota|billing|payment required|\b402\b/i.test(compactMessage)
  ) {
    appendProviderMessage();
    return {
      ok: false,
      code: "provider_quota_exceeded",
      provider: "openrouter",
      error: "OpenRouter credits appear to be exhausted. Add credits or switch models, then try again.",
      details: nextDetails
    };
  }

  if (/rate limit|\b429\b/i.test(compactMessage)) {
    appendProviderMessage();
    return {
      ok: false,
      code: "provider_rate_limited",
      provider: "openrouter",
      error: "The model provider is rate-limiting requests right now. Try again shortly.",
      details: nextDetails
    };
  }

  if (/unauthorized|invalid api key|\b401\b|forbidden/i.test(compactMessage)) {
    appendProviderMessage();
    return {
      ok: false,
      code: "provider_auth_error",
      provider: "openrouter",
      error: "The OpenRouter credentials appear to be invalid or expired.",
      details: nextDetails
    };
  }

  if (/did not include any text output|did not include message parts/i.test(lowerMessage)) {
    nextDetails.push("No final text output was returned.");
    return {
      ok: false,
      code: "opencode_no_text_output",
      error: "OpenCode finished without returning a final text answer.",
      details: nextDetails
    };
  }

  appendProviderMessage();

  return {
    ok: false,
    code: "opencode_worker_failed",
    error: "OpenCode failed before producing a final answer.",
    details: nextDetails
  };
}

function unwrapData<T>(value: WithOptionalData<T>): T {
  if (
    typeof value === "object" &&
    value !== null &&
    "data" in value
  ) {
    return (value as { data: T }).data;
  }

  return value as T;
}

async function pickOpenPort() {
  return new Promise<number>((resolvePort, reject) => {
    const server = createNetServer();

    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();

      if (!address || typeof address === "string") {
        server.close();
        reject(new Error("Failed to determine an OpenCode server port."));
        return;
      }

      server.close(() => resolvePort(address.port));
    });
  });
}

async function runPrompt(
  client: ReturnType<typeof createOpencodeClient>,
  question: string,
  model: string,
  requestId: string
): Promise<WorkerResponse> {
  const diagnostics: string[] = [];
  const addDiagnostic = (message: string) => {
    diagnostics.push(message);
  };
  let sessionId: string | null = null;
  let heartbeat: NodeJS.Timeout | null = null;
  try {
    logProgress(requestId, "session_create_start");
    const session = await client.session.create({
      responseStyle: "data",
      throwOnError: true,
      query: {
        directory: scopeRoot
      },
      body: {
        title: previewQuestion(question)
      }
    });
    const sessionData = unwrapData(session);
    sessionId = sessionData.id;
    logProgress(requestId, `session_create_finish id=${sessionId}`);
    addDiagnostic("Session created.");

    heartbeat =
      promptHeartbeatMs > 0
        ? setInterval(() => {
            logProgress(requestId, "prompt_waiting");
          }, promptHeartbeatMs)
        : null;

    logProgress(requestId, "prompt_start");
    addDiagnostic("Prompt started.");
    const response = await client.session.prompt({
      responseStyle: "data",
      throwOnError: true,
      path: {
        id: sessionId
      },
      query: {
        directory: scopeRoot
      },
      body: {
        agent: "general",
        model: {
          providerID: "openrouter",
          modelID: model
        },
        system: systemPrompt,
        parts: [
          {
            type: "text",
            text: question
          }
        ]
      }
    });

    const responseData = unwrapData(response);
    const responseDiagnostics = summarizeResponseParts(responseData.parts);

    for (const detail of responseDiagnostics) {
      addDiagnostic(detail);
      logProgress(requestId, `detail ${detail}`);
    }

    const answer = extractAnswer(responseData.parts);
    logProgress(requestId, "prompt_finish");
    addDiagnostic("Prompt finished.");

    return {
      ok: true,
      question,
      answer,
      sources: []
    };
  } catch (error) {
    throw new StructuredWorkerError(classifyWorkerError(error, diagnostics));
  } finally {
    if (heartbeat) {
      clearInterval(heartbeat);
    }

    if (sessionId) {
      logProgress(requestId, `session_delete_start id=${sessionId}`);
      try {
        await client.session.delete({
          responseStyle: "data",
          throwOnError: true,
          path: {
            id: sessionId
          },
          query: {
            directory: scopeRoot
          }
        });
        logProgress(requestId, `session_delete_finish id=${sessionId}`);
      } catch (error) {
        logProgress(
          requestId,
          `session_delete_error id=${sessionId} message="${error instanceof Error ? error.message : "unknown error"}"`
        );
      }
    }
  }
}

async function main() {
  const payload = await readStdin();
  const question = typeof payload.question === "string" ? payload.question.trim() : "";
  const limit = typeof payload.limit === "number" ? payload.limit : 6;
  const requestId = typeof payload.requestId === "string" && payload.requestId.trim()
    ? payload.requestId.trim()
    : "unknown";
  const selectedModel = resolveRequestedModelId(payload.model, resolveDefaultModelId());

  if (!question) {
    throw new Error("Question is required.");
  }

  if (!process.env.OPENROUTER_API_KEY) {
    throw new Error("OPENROUTER_API_KEY is not configured.");
  }

  const serverPort = await pickOpenPort();
  logProgress(
    requestId,
    `start limit=${limit} scope=${scopeRoot === vaultRoot ? "." : scopeRoot.slice(vaultRoot.length + 1)} heartbeat_ms=${promptHeartbeatMs} question="${previewQuestion(question)}"`
  );
  const opencodeServer = await createOpencodeServer({
    hostname: "127.0.0.1",
    port: serverPort,
    timeout: 15000,
    config: {
      model: toOpenCodeModelIdentifier(selectedModel),
      provider: {
        openrouter: {
          options: {
            apiKey: process.env.OPENROUTER_API_KEY
          }
        }
      },
      permission: {
        edit: "deny",
        bash: "allow",
        webfetch: "deny"
      }
    }
  });

  const client = createOpencodeClient({
    baseUrl: opencodeServer.url,
    throwOnError: true,
    responseStyle: "data"
  });

  try {
    logProgress(requestId, `opencode_server_ready port=${serverPort}`);
    const result = await runPrompt(client, question, selectedModel, requestId);
    await writeJson(result);
  } finally {
    logProgress(requestId, "shutdown");
    opencodeServer.close();
  }
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch(async (error) => {
    const response =
      error instanceof StructuredWorkerError
        ? error.response
        : classifyWorkerError(error, []);
    const message = error instanceof Error ? error.message : "Unknown error";

    process.stderr.write(`${message}\n`);

    try {
      await writeJson(response);
    } finally {
      process.exit(1);
    }
  });
