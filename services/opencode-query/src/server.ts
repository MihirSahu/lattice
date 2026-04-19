import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { access } from "node:fs/promises";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { getModelCatalog, resolveDefaultModelId, resolveRequestedModelId } from "./model-catalog.js";

type QueryRequest = {
  question?: unknown;
  folder?: unknown;
  limit?: unknown;
  model?: unknown;
};

type QueryWorkerResponse = {
  ok: true;
  question: string;
  answer: string;
  sources: Array<{
    id: string;
    title: string;
    path: string | null;
    snippet: string;
    score: number | null;
    context: string | null;
  }>;
};

type QueryWorkerErrorCode =
  | "opencode_timeout"
  | "opencode_no_text_output"
  | "provider_quota_exceeded"
  | "provider_rate_limited"
  | "provider_auth_error"
  | "opencode_worker_failed";

type QueryWorkerErrorResponse = {
  ok: false;
  error: string;
  details?: string[];
  code?: QueryWorkerErrorCode;
  provider?: string;
};

type QueryWorkerOutput = QueryWorkerResponse | QueryWorkerErrorResponse;

class QueryWorkerInvocationError extends Error {
  payload: QueryWorkerErrorResponse;

  constructor(payload: QueryWorkerErrorResponse) {
    super(payload.error);
    this.name = "QueryWorkerInvocationError";
    this.payload = payload;
  }
}

const port = Number(process.env.OPENCODE_QUERY_PORT || 8282);
const timeoutMs = Number(process.env.OPENCODE_QUERY_TIMEOUT_MS || 120000);
const vaultRoot = resolve(process.env.VAULT_MIRROR_DIR || "/srv/vault-mirror");
const workerPath = join(dirname(fileURLToPath(import.meta.url)), "query-worker.js");

function respond(res: ServerResponse, status: number, payload: unknown) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function previewQuestion(value: string) {
  const normalized = value.replace(/\s+/g, " ").trim();

  if (normalized.length <= 120) {
    return normalized;
  }

  return `${normalized.slice(0, 119)}…`;
}

function getRequestId(req: IncomingMessage) {
  const headerValue = req.headers["x-request-id"];
  const requestId = Array.isArray(headerValue) ? headerValue[0] : headerValue;
  return requestId?.trim() || randomUUID().slice(0, 8);
}

function prefixLogLines(prefix: string, value: string) {
  const trimmed = value.replace(/\s+$/, "");

  if (!trimmed) {
    return "";
  }

  return `${trimmed
    .split(/\r?\n/)
    .map((line) => `${prefix} ${line}`)
    .join("\n")}\n`;
}

async function readBody(req: IncomingMessage): Promise<QueryRequest> {
  const chunks: Buffer[] = [];

  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  if (chunks.length === 0) {
    return {};
  }

  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as QueryRequest;
}

function normalizeFolderPath(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value
    .trim()
    .replaceAll("\\", "/")
    .replace(/^\/+/, "")
    .replace(/\/+$/, "");

  return normalized || null;
}

async function resolveScopeRoot(folder: unknown) {
  const normalizedFolder = normalizeFolderPath(folder);
  const scopeRoot = normalizedFolder ? resolve(vaultRoot, normalizedFolder) : vaultRoot;
  const relativePath = relative(vaultRoot, scopeRoot);

  if (relativePath.startsWith("..") || relativePath.includes(`..${process.platform === "win32" ? "\\" : "/"}`)) {
    throw new Error("Folder must stay within the vault mirror.");
  }

  await access(scopeRoot);

  return {
    folder: normalizedFolder,
    scopeRoot
  };
}

function runWorker(
  payload: { question: string; limit: number; folder: string | null; model: string; requestId: string },
  scopeRoot: string
): Promise<QueryWorkerResponse> {
  return new Promise((resolveResult, reject) => {
    const child = spawn(process.execPath, [workerPath], {
      cwd: scopeRoot,
      env: {
        ...process.env,
        VAULT_MIRROR_DIR: vaultRoot
      },
      stdio: ["pipe", "pipe", "pipe"]
    });

    let stdout = "";
    let stderr = "";
    let settled = false;
    let timer: NodeJS.Timeout | null = null;

    const clearTimer = () => {
      if (!timer) {
        return;
      }

      clearTimeout(timer);
      timer = null;
    };

    const armTimer = () => {
      if (settled || timeoutMs <= 0) {
        return;
      }

      clearTimer();
      timer = setTimeout(() => {
        if (settled) {
          return;
        }

        settled = true;
        console.error(`[opencode:${payload.requestId}] inactivity_timeout after ${timeoutMs}ms`);
        child.kill("SIGKILL");
        reject(
          new QueryWorkerInvocationError({
            ok: false,
            code: "opencode_timeout",
            error: `OpenCode query timed out after ${timeoutMs}ms of inactivity.`,
            details: ["The worker stopped producing output before completion."]
          })
        );
      }, timeoutMs);
    };

    armTimer();

    child.stdin.on("error", () => {
      // Ignore EPIPE if the worker exits before consuming stdin.
    });

    child.stdout.on("data", (chunk) => {
      armTimer();
      stdout += chunk.toString("utf8");
    });

    child.stderr.on("data", (chunk) => {
      armTimer();
      const text = chunk.toString("utf8");
      stderr += text;
      process.stderr.write(prefixLogLines(`[opencode-worker:${payload.requestId}]`, text));
    });

    child.on("error", (error) => {
      if (settled) {
        return;
      }

      settled = true;
      clearTimer();
      reject(error);
    });

    child.on("close", (code) => {
      if (settled) {
        return;
      }

      settled = true;
      clearTimer();
      console.log(`[opencode:${payload.requestId}] worker_exit code=${code ?? -1}`);

      if (code !== 0) {
        try {
          const parsed = stdout ? (JSON.parse(stdout) as QueryWorkerOutput) : null;

          if (parsed && !parsed.ok) {
            reject(new QueryWorkerInvocationError(parsed));
            return;
          }
        } catch {
          // Fall through to the generic worker failure below.
        }

        reject(
          new QueryWorkerInvocationError({
            ok: false,
            code: "opencode_worker_failed",
            error: "OpenCode worker failed before returning a structured error.",
            details: ["Check opencode-query logs for more detail."]
          })
        );
        return;
      }

      try {
        resolveResult(JSON.parse(stdout) as QueryWorkerResponse);
      } catch (error) {
        reject(new Error(`Failed to parse OpenCode worker output: ${error instanceof Error ? error.message : "unknown error"}`));
      }
    });

    child.stdin.end(JSON.stringify(payload));
  });
}

const server = createServer(async (req, res) => {
  const requestId = getRequestId(req);
  const startedAt = Date.now();

  try {
    if (!req.url) {
      respond(res, 400, { error: "Missing URL." });
      return;
    }

    const url = new URL(req.url, `http://127.0.0.1:${port}`);

    if (req.method === "GET" && url.pathname === "/health") {
      const providerConfigured = Boolean(process.env.OPENROUTER_API_KEY);
      const defaultModel = resolveDefaultModelId();

      respond(res, providerConfigured ? 200 : 503, {
        ok: providerConfigured,
        providerConfigured,
        model: defaultModel
      });
      return;
    }

    if (req.method === "GET" && url.pathname === "/models") {
      respond(res, 200, {
        ok: true,
        models: getModelCatalog()
      });
      return;
    }

    if (req.method === "POST" && url.pathname === "/query") {
      if (!process.env.OPENROUTER_API_KEY) {
        respond(res, 500, { ok: false, error: "OPENROUTER_API_KEY is not configured." });
        return;
      }

      const body = await readBody(req);
      const question = typeof body.question === "string" ? body.question.trim() : "";
      const limit = typeof body.limit === "number" ? body.limit : 6;
      const selectedModel = resolveRequestedModelId(body.model);

      if (!question) {
        respond(res, 400, { ok: false, error: "Question is required." });
        return;
      }

      const { folder, scopeRoot } = await resolveScopeRoot(body.folder);

      console.log(
        `[opencode:${requestId}] start folder=${folder ?? "<all>"} model=${selectedModel} limit=${limit} scope=${relative(vaultRoot, scopeRoot) || "."} question="${previewQuestion(question)}"`
      );

      const result = await runWorker({ question, limit, folder, model: selectedModel, requestId }, scopeRoot);

      console.log(
        `[opencode:${requestId}] finish duration_ms=${Date.now() - startedAt} sources=${result.sources.length}`
      );

      respond(res, 200, {
        ...result,
        backend: "opencode",
        mode: "agent",
        provider: "openrouter",
        model: selectedModel,
        folder,
        duration_ms: Date.now() - startedAt
      });
      return;
    }

    respond(res, 404, { ok: false, error: "Not found" });
  } catch (error) {
    if (error instanceof QueryWorkerInvocationError) {
      const status = error.payload.code === "opencode_timeout"
        ? 504
        : error.payload.code === "provider_rate_limited"
          ? 429
          : 502;
      console.error(
        `[opencode:${requestId}] error duration_ms=${Date.now() - startedAt} code="${error.payload.code ?? "unknown"}" message="${error.payload.error}"`
      );
      respond(res, status, error.payload);
      return;
    }

    const message = error instanceof Error ? error.message : "Unknown error";
    const status = /within the vault mirror|required|ENOENT|Unsupported OpenCode model/i.test(message) ? 400 : 502;
    console.error(`[opencode:${requestId}] error duration_ms=${Date.now() - startedAt} message="${message}"`);
    respond(res, status, { ok: false, error: message });
  }
});

server.listen(port, "0.0.0.0", () => {
  console.log(`OpenCode query service listening on :${port}`);
});
