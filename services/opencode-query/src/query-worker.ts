import { createServer as createNetServer } from "node:net";
import { isAbsolute, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createOpencodeClient, createOpencodeServer } from "@opencode-ai/sdk";
import type { ServerOptions } from "@opencode-ai/sdk/server";
import { loadOpenAiAuth, type LoadedOpenAiAuth } from "./openai-auth.js";
import {
  type AllowedModelId,
  type OpenAiRoute,
  resolveDefaultModelId,
  resolveOpenAiRoute,
  resolveOpenCodeModelSelection,
  resolveRequestedModelId
} from "./model-catalog.js";
import {
  encodeNdjsonEvent,
  type OpenCodeTraceEvent,
  type TraceFileOperation,
  type TraceFileReference,
  type TraceTokenUsage,
  type WorkerErrorResponse,
  type WorkerResponse,
  type WorkerStreamEvent
} from "./stream-events.js";

type WorkerRequest = {
  question?: unknown;
  limit?: unknown;
  requestId?: unknown;
  model?: unknown;
  openAiRoute?: unknown;
};

type TextPart = {
  type: string;
  text?: string;
};

type OpenCodeResponseDiagnostics = {
  provider?: string;
  model?: string;
  finish?: string;
  details: string[];
  errorMessage?: string;
};

type WithOptionalData<T> = T | { data: T };

type WorkerEnv = NodeJS.ProcessEnv & {
  OPENROUTER_API_KEY?: string;
};

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
export const disabledSubagentTools = {
  task: false
} as const;
const systemPrompt = [
  "You are answering questions from local journal/note files in the current working directory tree.",
  "Perform an exhaustive recursive inspection of the current working directory tree before answering.",
  "Use the available tools to inspect the actual files in this folder tree, not just the directory names.",
  "Do not delegate work to subagents; inspect files directly in this session.",
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

function writeEvent(event: WorkerStreamEvent) {
  return new Promise<void>((resolveWrite, reject) => {
    process.stdout.write(encodeNdjsonEvent(event), (error) => {
      if (error) {
        reject(error);
        return;
      }

      resolveWrite();
    });
  });
}

export function extractAnswer(parts: unknown, diagnostics?: OpenCodeResponseDiagnostics) {
  if (!Array.isArray(parts)) {
    throw new StructuredWorkerError(createNoTextOutputError(diagnostics, "OpenCode response did not include message parts."));
  }

  const text = (parts as TextPart[])
    .filter((part) => part.type === "text" && typeof part.text === "string")
    .map((part) => part.text?.trim() || "")
    .filter(Boolean)
    .join("\n\n")
    .trim();

  if (!text) {
    throw new StructuredWorkerError(createNoTextOutputError(diagnostics, "OpenCode response did not include any text output."));
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

function getDiagnosticsProvider(details: string[]) {
  const providerDetail = details.find((detail) => detail.startsWith("OpenCode response provider: "));

  if (!providerDetail) {
    return "openrouter";
  }

  return providerDetail.slice("OpenCode response provider: ".length).trim() || "openrouter";
}

function createNoTextOutputError(diagnostics: OpenCodeResponseDiagnostics | undefined, message: string): WorkerErrorResponse {
  return {
    ok: false,
    code: "opencode_no_text_output",
    provider: diagnostics?.provider,
    error: "OpenCode finished without returning a final text answer.",
    details: [
      ...(diagnostics?.details ?? []),
      `Provider message: ${truncateDetail(message)}`,
      "No final text output was returned."
    ]
  };
}

function createAssistantResponseError(diagnostics: OpenCodeResponseDiagnostics): WorkerErrorResponse {
  return {
    ok: false,
    code: "opencode_worker_failed",
    provider: diagnostics.provider,
    error: diagnostics.errorMessage
      ? `OpenCode returned a ${diagnostics.provider ?? "provider"} response error: ${truncateDetail(diagnostics.errorMessage)}`
      : "OpenCode returned a provider response error before producing a final answer.",
    details: diagnostics.details
  };
}

function classifyWorkerError(error: unknown, details: string[]): WorkerErrorResponse {
  if (error instanceof StructuredWorkerError) {
    return error.response;
  }

  const rawMessage = error instanceof Error ? error.message : String(error ?? "Unknown error");
  const compactMessage = rawMessage.replace(/\s+/g, " ").trim();
  const lowerMessage = compactMessage.toLowerCase();
  const nextDetails = [...details];
  const provider = getDiagnosticsProvider(nextDetails);
  const providerLabel = provider === "openai" ? "OpenAI" : "OpenRouter";

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
      provider,
      error:
        provider === "openai"
          ? "OpenAI appears to have rejected the request for quota, billing, or plan access reasons."
          : "OpenRouter credits appear to be exhausted. Add credits or switch models, then try again.",
      details: nextDetails
    };
  }

  if (/rate limit|\b429\b/i.test(compactMessage)) {
    appendProviderMessage();
    return {
      ok: false,
      code: "provider_rate_limited",
      provider,
      error: "The model provider is rate-limiting requests right now. Try again shortly.",
      details: nextDetails
    };
  }

  if (/unauthorized|invalid api key|\b401\b|forbidden/i.test(compactMessage)) {
    appendProviderMessage();
    return {
      ok: false,
      code: "provider_auth_error",
      provider,
      error: `The ${providerLabel} credentials appear to be invalid or expired.`,
      details: nextDetails
    };
  }

  if (/did not include any text output|did not include message parts/i.test(lowerMessage)) {
    return createNoTextOutputError({ provider, details: nextDetails }, compactMessage);
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

function getRecordNumber(value: Record<string, unknown>, key: string) {
  const nextValue = value[key];

  return typeof nextValue === "number" && Number.isFinite(nextValue) ? nextValue : null;
}

function getRecordBoolean(value: Record<string, unknown>, key: string) {
  const nextValue = value[key];

  return typeof nextValue === "boolean" ? nextValue : null;
}

function getSafeErrorField(error: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = error[key];

    if (typeof value === "string" && value.trim()) {
      return truncateDetail(value.trim());
    }
  }

  return null;
}

function countPartTypes(parts: unknown) {
  if (!Array.isArray(parts)) {
    return "not-array";
  }

  if (parts.length === 0) {
    return "none";
  }

  const counts = new Map<string, number>();

  for (const part of parts) {
    const type = part && typeof part === "object" && typeof (part as Record<string, unknown>).type === "string"
      ? (part as Record<string, unknown>).type as string
      : "unknown";
    counts.set(type, (counts.get(type) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .map(([type, count]) => `${type}:${count}`)
    .join(", ");
}

function getSafeTopLevelKeys(value: unknown) {
  if (!value || typeof value !== "object") {
    return typeof value;
  }

  return Object.keys(value as Record<string, unknown>)
    .filter((key) => !/token|authorization|auth|secret|key|body|content|text/i.test(key))
    .sort()
    .slice(0, 12)
    .join(", ") || "none";
}

export function getOpenCodeResponseDiagnostics(responseData: unknown): OpenCodeResponseDiagnostics {
  const record = responseData && typeof responseData === "object" ? responseData as Record<string, unknown> : {};
  const info = record.info && typeof record.info === "object" ? record.info as Record<string, unknown> : {};
  const provider = getRecordString(info, "providerID") ?? undefined;
  const model = getRecordString(info, "modelID") ?? undefined;
  const finish = getRecordString(info, "finish") ?? undefined;
  const details: string[] = [];

  if (provider) {
    details.push(`OpenCode response provider: ${provider}`);
  }

  if (model) {
    details.push(`OpenCode response model: ${model}`);
  }

  if (finish) {
    details.push(`OpenCode response finish: ${finish}`);
  }

  details.push(`OpenCode response parts: ${countPartTypes(record.parts)}`);

  if (!Array.isArray(record.parts)) {
    details.push(`OpenCode response keys: ${getSafeTopLevelKeys(responseData)}`);
  }

  const error = info.error && typeof info.error === "object" ? info.error as Record<string, unknown> : null;
  const errorName = error ? getSafeErrorField(error, ["name", "type", "code"]) : null;
  const errorMessage = error ? getSafeErrorField(error, ["message", "error"]) : null;
  const statusCode = error ? getRecordNumber(error, "statusCode") : null;
  const isRetryable = error ? getRecordBoolean(error, "isRetryable") : null;

  if (errorName) {
    details.push(`OpenCode response error: ${errorName}`);
  }

  if (errorMessage) {
    details.push(`OpenCode response error message: ${errorMessage}`);
  }

  if (statusCode !== null) {
    details.push(`OpenCode response status: ${statusCode}`);
  }

  if (isRetryable !== null) {
    details.push(`OpenCode response retryable: ${isRetryable}`);
  }

  return {
    provider,
    model,
    finish,
    details,
    errorMessage: errorMessage ?? undefined
  };
}

export function assertOpenCodeResponseHasNoAssistantError(responseData: unknown) {
  const record = responseData && typeof responseData === "object" ? responseData as Record<string, unknown> : {};
  const info = record.info && typeof record.info === "object" ? record.info as Record<string, unknown> : {};

  if (!info.error) {
    return;
  }

  throw new StructuredWorkerError(createAssistantResponseError(getOpenCodeResponseDiagnostics(responseData)));
}

function getRecordString(value: Record<string, unknown>, key: string) {
  const nextValue = value[key];

  return typeof nextValue === "string" && nextValue.trim() ? nextValue.trim() : null;
}

function truncateSummary(value: string, maxLength = 180) {
  const normalized = value.replace(/\s+/g, " ").trim();

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength - 1)}…`;
}

function isInside(parent: string, child: string) {
  const relativePath = relative(parent, child);

  return relativePath === "" || (!relativePath.startsWith("..") && !isAbsolute(relativePath));
}

function normalizeTracePath(value: string) {
  const trimmed = value.trim().replace(/^file:\/\//, "").replaceAll("\\", "/");

  if (!trimmed || trimmed.includes("\n")) {
    return null;
  }

  const absolutePath = isAbsolute(trimmed) ? resolve(trimmed) : resolve(scopeRoot, trimmed);

  if (isInside(scopeRoot, absolutePath)) {
    return relative(scopeRoot, absolutePath) || ".";
  }

  if (isInside(vaultRoot, absolutePath)) {
    return relative(vaultRoot, absolutePath) || ".";
  }

  if (!isAbsolute(trimmed) && !trimmed.startsWith("..")) {
    return trimmed;
  }

  return null;
}

function inferToolOperation(toolName: string): TraceFileOperation {
  const normalized = toolName.toLowerCase();

  if (/read|view|cat|open/.test(normalized)) {
    return "read";
  }

  if (/grep|search|find|glob/.test(normalized)) {
    return "search";
  }

  if (/list|ls|tree/.test(normalized)) {
    return "list";
  }

  if (/write|edit|patch|create/.test(normalized)) {
    return "write";
  }

  if (/bash|shell|command/.test(normalized)) {
    return "command";
  }

  return "unknown";
}

function collectStrings(value: unknown): string[] {
  if (typeof value === "string") {
    return [value];
  }

  if (Array.isArray(value)) {
    return value.flatMap((item) => collectStrings(item));
  }

  return [];
}

function uniqueFiles(files: TraceFileReference[]) {
  const seen = new Set<string>();

  return files.filter((file) => {
    const key = `${file.operation}:${file.path}:${file.lineStart ?? ""}:${file.lineEnd ?? ""}:${file.source ?? ""}`;

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function extractInputFiles(input: Record<string, unknown>, operation: TraceFileOperation) {
  const pathKeys = ["path", "file", "files", "filePath", "filepath", "filename", "paths", "directory", "dir", "cwd"];
  const files: TraceFileReference[] = [];

  for (const key of pathKeys) {
    for (const value of collectStrings(input[key])) {
      const path = normalizeTracePath(value);

      if (path) {
        files.push({ path, operation, source: key });
      }
    }
  }

  return uniqueFiles(files);
}

function getInputSummary(toolName: string, input: Record<string, unknown>, raw: string | null) {
  const summaryFields = ["path", "filePath", "filepath", "pattern", "query", "command", "cmd", "directory"];
  const parts: string[] = [];

  for (const key of summaryFields) {
    const value = input[key];

    if (typeof value === "string" && value.trim()) {
      parts.push(`${key}: ${truncateSummary(value, 80)}`);
    }
  }

  if (parts.length > 0) {
    return parts.join(" | ");
  }

  if (raw) {
    return truncateSummary(raw);
  }

  return toolName;
}

function getStateTimeMs(state: Record<string, unknown>) {
  const time = state.time && typeof state.time === "object" ? state.time as Record<string, unknown> : null;
  const start = typeof time?.start === "number" ? time.start : null;
  const end = typeof time?.end === "number" ? time.end : null;

  return start !== null && end !== null && end >= start ? Math.round(end - start) : undefined;
}

function getToolMetadata(toolName: string, state: Record<string, unknown> | null) {
  const input = state?.input && typeof state.input === "object" ? state.input as Record<string, unknown> : {};
  const raw = state ? getRecordString(state, "raw") : null;
  const operation = inferToolOperation(toolName);
  const files = extractInputFiles(input, operation);
  const output = state ? getRecordString(state, "output") : null;
  const error = state ? getRecordString(state, "error") : null;

  return {
    status: state ? getRecordString(state, "status") ?? undefined : undefined,
    inputSummary: getInputSummary(toolName, input, raw),
    outputSummary: output ? truncateSummary(output) : undefined,
    elapsedMs: state ? getStateTimeMs(state) : undefined,
    files,
    error: error ?? undefined
  };
}

function getFileReference(part: Record<string, unknown>): TraceFileReference | null {
  const source = part.source && typeof part.source === "object" ? part.source as Record<string, unknown> : null;
  const sourceRecord = source ?? {};
  const range = source?.range && typeof source.range === "object" ? source.range as Record<string, unknown> : null;
  const rangeStart = range?.start && typeof range.start === "object" ? range.start as Record<string, unknown> : null;
  const rangeEnd = range?.end && typeof range.end === "object" ? range.end as Record<string, unknown> : null;
  const rawPath = getRecordString(sourceRecord, "path") ?? getRecordString(part, "filename") ?? getRecordString(part, "url");
  const path = rawPath ? normalizeTracePath(rawPath) : null;

  if (!path) {
    return null;
  }

  return {
    path,
    operation: "read",
    lineStart: typeof rangeStart?.line === "number" ? rangeStart.line : undefined,
    lineEnd: typeof rangeEnd?.line === "number" ? rangeEnd.line : undefined,
    source: getRecordString(sourceRecord, "type") ?? "file"
  };
}

function getStepTokens(part: Record<string, unknown>): TraceTokenUsage | undefined {
  const tokens = part.tokens && typeof part.tokens === "object" ? part.tokens as Record<string, unknown> : null;
  const cache = tokens?.cache && typeof tokens.cache === "object" ? tokens.cache as Record<string, unknown> : null;
  const input = typeof tokens?.input === "number" ? tokens.input : null;
  const output = typeof tokens?.output === "number" ? tokens.output : null;
  const reasoning = typeof tokens?.reasoning === "number" ? tokens.reasoning : null;
  const cacheRead = typeof cache?.read === "number" ? cache.read : null;
  const cacheWrite = typeof cache?.write === "number" ? cache.write : null;

  if (input === null || output === null || reasoning === null || cacheRead === null || cacheWrite === null) {
    return undefined;
  }

  return {
    input,
    output,
    reasoning,
    cacheRead,
    cacheWrite
  };
}

function getToolLabel(part: Record<string, unknown>) {
  const state = part.state && typeof part.state === "object" ? part.state as Record<string, unknown> : {};
  const toolName = getRecordString(part, "tool") ?? "tool";
  const stateTitle = getRecordString(state, "title");

  return stateTitle ?? toolName;
}

export function createOpenCodeEventMapper(sessionId: string, emit: (event: OpenCodeTraceEvent) => void) {
  const reasoningTextByPartId = new Map<string, string>();
  const toolStatusByPartId = new Map<string, string>();

  return (event: unknown) => {
    if (!event || typeof event !== "object") {
      return;
    }

    const record = event as Record<string, unknown>;
    const eventType = getRecordString(record, "type");
    const properties = record.properties && typeof record.properties === "object"
      ? record.properties as Record<string, unknown>
      : null;

    if (eventType === "session.status" && properties?.sessionID === sessionId) {
      const status = properties.status && typeof properties.status === "object"
        ? properties.status as Record<string, unknown>
        : null;
      const statusType = status ? getRecordString(status, "type") : null;

      if (statusType === "busy") {
        emit({ type: "status", message: "OpenCode is working..." });
      }

      if (statusType === "idle") {
        emit({ type: "status", message: "OpenCode is idle." });
      }

      return;
    }

    if (eventType !== "message.part.updated" || !properties) {
      return;
    }

    const part = properties.part && typeof properties.part === "object"
      ? properties.part as Record<string, unknown>
      : null;

    if (!part || part.sessionID !== sessionId) {
      return;
    }

    const partId = getRecordString(part, "id") ?? "";
    const partType = getRecordString(part, "type");

    if (partType === "reasoning") {
      const fullText = typeof part.text === "string" ? part.text : "";
      const explicitDelta = typeof properties.delta === "string" ? properties.delta : "";
      const previousText = reasoningTextByPartId.get(partId) ?? "";
      const fallbackDelta = fullText.startsWith(previousText) ? fullText.slice(previousText.length) : fullText;
      const delta = explicitDelta || fallbackDelta;

      reasoningTextByPartId.set(partId, fullText);

      if (delta) {
        emit({ type: "reasoning_delta", text: delta });
      }

      return;
    }

    if (partType === "tool") {
      const state = part.state && typeof part.state === "object" ? part.state as Record<string, unknown> : null;
      const status = state ? getRecordString(state, "status") : null;

      if (!status) {
        return;
      }

      const previousStatus = toolStatusByPartId.get(partId);
      const toolName = getRecordString(part, "tool") ?? "tool";
      const callId = getRecordString(part, "callID") ?? partId;
      const label = getToolLabel(part);
      const metadata = getToolMetadata(toolName, state);

      if (!previousStatus && (status === "pending" || status === "running")) {
        toolStatusByPartId.set(partId, status);
        emit({ type: "tool_start", toolName, toolUseId: callId, label, ...metadata });

        if (metadata.files.length > 0) {
          emit({ type: "file_access", label: `Using ${metadata.files.length} file path${metadata.files.length === 1 ? "" : "s"}.`, files: metadata.files, toolName, toolUseId: callId });
        }

        return;
      }

      if (previousStatus !== status && status === "running") {
        toolStatusByPartId.set(partId, status);
        emit({ type: "tool_progress", toolName, toolUseId: callId, message: label, ...metadata });
        return;
      }

      if (previousStatus !== status && status === "completed") {
        toolStatusByPartId.set(partId, status);
        emit({ type: "tool_finish", toolName, toolUseId: callId, label, ...metadata });

        if (metadata.files.length > 0) {
          emit({ type: "file_access", label: `Completed ${metadata.files.length} file operation${metadata.files.length === 1 ? "" : "s"}.`, files: metadata.files, toolName, toolUseId: callId });
        }

        return;
      }

      if (previousStatus !== status && status === "error") {
        toolStatusByPartId.set(partId, status);
        const error = state ? getRecordString(state, "error") : null;
        emit({ type: "tool_error", toolName, toolUseId: callId, label: error ?? label, ...metadata });
      }

      return;
    }

    if (partType === "file") {
      const file = getFileReference(part);

      if (file) {
        emit({ type: "file_access", label: `Read ${file.path}.`, files: [file] });
      }

      return;
    }

    if (partType === "step-start") {
      emit({ type: "thinking", message: "Started a reasoning step." });
      return;
    }

    if (partType === "step-finish") {
      const reason = getRecordString(part, "reason");
      const cost = typeof part.cost === "number" ? part.cost : undefined;
      emit({
        type: "thinking",
        message: reason ? `Finished a reasoning step: ${reason}.` : "Finished a reasoning step.",
        tokens: getStepTokens(part),
        cost
      });
    }
  };
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

export async function resolveOpenCodeRuntimeConfig(
  selectedModel: AllowedModelId,
  openAiRoute: OpenAiRoute = "subscription",
  env: WorkerEnv = process.env
) {
  const modelSelection = resolveOpenCodeModelSelection(selectedModel, openAiRoute);
  const baseConfig: NonNullable<ServerOptions["config"]> = {
    model: modelSelection.configModel,
    enabled_providers: [modelSelection.providerID],
    tools: disabledSubagentTools,
    agent: {
      general: {
        tools: disabledSubagentTools
      }
    },
    permission: {
      edit: "deny",
      bash: "allow",
      webfetch: "deny"
    }
  };

  if (modelSelection.providerID === "openrouter") {
    if (!env.OPENROUTER_API_KEY) {
      throw new Error("OPENROUTER_API_KEY is not configured.");
    }

    return {
      modelSelection,
      openAiAuth: null,
      config: {
        ...baseConfig,
        provider: {
          openrouter: {
            options: {
              apiKey: env.OPENROUTER_API_KEY
            }
          }
        }
      }
    };
  }

  const openAiAuth = await loadOpenAiAuth(env);

  if (!openAiAuth) {
    throw new Error("OpenAI auth is not configured. Set OPENCODE_OPENAI_AUTH_FILE or OPENCODE_OPENAI_AUTH_JSON, or mount OpenCode auth.json.");
  }

  return {
    modelSelection,
    openAiAuth,
    config: baseConfig
  };
}

export async function setOpenAiAuth(
  client: ReturnType<typeof createOpencodeClient>,
  auth: LoadedOpenAiAuth,
  requestId: string
) {
  const expiresAt = new Date(auth.expires).toISOString();
  logProgress(requestId, `openai_auth_set_start source=${auth.source} expires=${expiresAt}`);
  await client.auth.set({
    responseStyle: "data",
    throwOnError: true,
    path: {
      id: "openai"
    },
    query: {
      directory: scopeRoot
    },
    body: auth.auth
  });
  logProgress(requestId, `openai_auth_set_finish source=${auth.source} expires=${expiresAt}`);
}

async function runPrompt(
  client: ReturnType<typeof createOpencodeClient>,
  question: string,
  model: string,
  modelSelection: ReturnType<typeof resolveOpenCodeModelSelection>,
  requestId: string,
  emit: (event: OpenCodeTraceEvent) => Promise<void>
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
    await emit({ type: "session", sessionId, model });

    heartbeat =
      promptHeartbeatMs > 0
        ? setInterval(() => {
            logProgress(requestId, "prompt_waiting");
          }, promptHeartbeatMs)
        : null;

    logProgress(requestId, "prompt_start");
    addDiagnostic("Prompt started.");
    await emit({ type: "status", message: "Prompt started." });

    const eventAbort = new AbortController();
    let eventStreamError: unknown = null;
    const mapOpenCodeEvent = createOpenCodeEventMapper(sessionId, (event) => {
      void emit(event);
    });
    const eventSubscription = await client.event.subscribe({
      query: {
        directory: scopeRoot
      },
      signal: eventAbort.signal
    });
    const eventPump = (async () => {
      try {
        for await (const event of eventSubscription.stream) {
          mapOpenCodeEvent(event);
        }
      } catch (error) {
        eventStreamError = error;
      }
    })();

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
          providerID: modelSelection.providerID,
          modelID: modelSelection.modelID
        },
        tools: disabledSubagentTools,
        system: systemPrompt,
        parts: [
          {
            type: "text",
            text: question
          }
        ]
      }
    }).finally(async () => {
      eventAbort.abort();
      await eventPump;
    });

    if (eventStreamError && !(eventStreamError instanceof Error && /abort/i.test(eventStreamError.message))) {
      logProgress(requestId, `event_stream_error message="${eventStreamError instanceof Error ? eventStreamError.message : "unknown"}"`);
    }

    const responseData = unwrapData(response);
    const responseDiagnostics = getOpenCodeResponseDiagnostics(responseData);

    for (const detail of responseDiagnostics.details) {
      addDiagnostic(detail);
      logProgress(requestId, `detail ${detail}`);
    }

    assertOpenCodeResponseHasNoAssistantError(responseData);
    const responsePartDiagnostics = summarizeResponseParts(responseData.parts);

    for (const detail of responsePartDiagnostics) {
      addDiagnostic(detail);
      logProgress(requestId, `detail ${detail}`);
    }

    const answer = extractAnswer(responseData.parts, responseDiagnostics);
    logProgress(requestId, "prompt_finish");
    addDiagnostic("Prompt finished.");
    await emit({ type: "status", message: "Prompt finished." });

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
  const openAiRoute = resolveOpenAiRoute(payload.openAiRoute);

  if (!question) {
    throw new Error("Question is required.");
  }

  const runtimeConfig = await resolveOpenCodeRuntimeConfig(selectedModel, openAiRoute);

  const serverPort = await pickOpenPort();
  logProgress(
    requestId,
    `start limit=${limit} provider=${runtimeConfig.modelSelection.providerID} model=${runtimeConfig.modelSelection.modelID} openai_route=${openAiRoute} scope=${scopeRoot === vaultRoot ? "." : scopeRoot.slice(vaultRoot.length + 1)} heartbeat_ms=${promptHeartbeatMs} question="${previewQuestion(question)}"`
  );
  const opencodeServer = await createOpencodeServer({
    hostname: "127.0.0.1",
    port: serverPort,
    timeout: 15000,
    config: runtimeConfig.config
  });

  const client = createOpencodeClient({
    baseUrl: opencodeServer.url,
    throwOnError: true,
    responseStyle: "data"
  });

  try {
    logProgress(requestId, `opencode_server_ready port=${serverPort}`);
    if (runtimeConfig.openAiAuth) {
      await setOpenAiAuth(client, runtimeConfig.openAiAuth, requestId);
    }
    await writeEvent({ type: "status", message: "OpenCode server is ready." });
    const result = await runPrompt(client, question, selectedModel, runtimeConfig.modelSelection, requestId, (event) =>
      writeEvent(event)
    );
    await writeEvent({ type: "final", result });
  } finally {
    logProgress(requestId, "shutdown");
    opencodeServer.close();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
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
        await writeEvent({ type: "error", error: response });
      } finally {
        process.exit(1);
      }
    });
}
