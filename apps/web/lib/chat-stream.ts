import { askErrorResponseSchema, askResponseSchema, chatAskResponseSchema, type AskErrorResponse, type AskResponse, type ChatAskResponse } from "./schemas.ts";
import { NdjsonLineParser } from "./ndjson.ts";

export type OpenCodeTraceEvent =
  | ({ type: "status"; message: string } & OpenCodeTraceMetadata)
  | ({ type: "session"; sessionId: string; model: string } & OpenCodeTraceMetadata)
  | ({ type: "thinking"; message: string } & OpenCodeTraceMetadata)
  | { type: "reasoning_delta"; text: string }
  | ({ type: "tool_start"; toolName: string; toolUseId: string; label: string } & OpenCodeTraceMetadata)
  | ({ type: "tool_progress"; toolName: string; toolUseId: string; message: string } & OpenCodeTraceMetadata)
  | ({ type: "tool_finish"; toolName: string; toolUseId: string; label: string } & OpenCodeTraceMetadata)
  | ({ type: "tool_error"; toolName: string; toolUseId: string; label: string } & OpenCodeTraceMetadata)
  | ({ type: "file_access"; label: string; files: TraceFileReference[]; toolName?: string; toolUseId?: string } & OpenCodeTraceMetadata);

export type TraceFileOperation = "read" | "search" | "list" | "write" | "command" | "unknown";

export type TraceFileReference = {
  path: string;
  operation: TraceFileOperation;
  lineStart?: number;
  lineEnd?: number;
  source?: string;
};

export type TraceTokenUsage = {
  input: number;
  output: number;
  reasoning: number;
  cacheRead: number;
  cacheWrite: number;
};

export type OpenCodeTraceMetadata = {
  status?: string;
  inputSummary?: string;
  outputSummary?: string;
  elapsedMs?: number;
  files?: TraceFileReference[];
  tokens?: TraceTokenUsage;
  cost?: number;
  error?: string;
};

export type QueryEngineStreamEvent =
  | OpenCodeTraceEvent
  | { type: "final"; result: AskResponse }
  | { type: "error"; error: AskErrorResponse };

export type ChatAskStreamEvent =
  | OpenCodeTraceEvent
  | { type: "final"; response: ChatAskResponse }
  | { type: "error"; message: string; error?: AskErrorResponse };

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

export function parseQueryEngineStreamEvent(value: unknown): QueryEngineStreamEvent {
  if (!isObject(value) || typeof value.type !== "string") {
    throw new Error("Invalid stream event.");
  }

  if (value.type === "final") {
    return {
      type: "final",
      result: askResponseSchema.parse(value.result)
    };
  }

  if (value.type === "error") {
    return {
      type: "error",
      error: askErrorResponseSchema.parse(value.error)
    };
  }

  return value as OpenCodeTraceEvent;
}

export function parseChatAskStreamEvent(value: unknown): ChatAskStreamEvent {
  if (!isObject(value) || typeof value.type !== "string") {
    throw new Error("Invalid chat stream event.");
  }

  if (value.type === "final") {
    return {
      type: "final",
      response: chatAskResponseSchema.parse(value.response)
    };
  }

  if (value.type === "error") {
    return {
      type: "error",
      message: typeof value.message === "string" ? value.message : "Chat request failed.",
      error: isObject(value.error) ? askErrorResponseSchema.parse(value.error) : undefined
    };
  }

  return value as OpenCodeTraceEvent;
}

export async function readNdjsonStream<T>(
  response: Response,
  parse: (value: unknown) => T,
  onEvent: (event: T) => void
) {
  if (!response.body) {
    throw new Error("Response did not include a stream body.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const parser = new NdjsonLineParser<unknown>();

  while (true) {
    const { value, done } = await reader.read();

    if (done) {
      break;
    }

    const chunk = decoder.decode(value, { stream: true });

    for (const rawEvent of parser.push(chunk)) {
      onEvent(parse(rawEvent));
    }
  }

  const remaining = decoder.decode();
  const rawEvents = remaining ? parser.push(remaining) : [];

  for (const rawEvent of [...rawEvents, ...parser.flush()]) {
    onEvent(parse(rawEvent));
  }
}
