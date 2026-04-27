export type WorkerSource = {
  id: string;
  title: string;
  path: string | null;
  snippet: string;
  score: number | null;
  context: string | null;
};

export type WorkerResponse = {
  ok: true;
  question: string;
  answer: string;
  sources: WorkerSource[];
};

export type WorkerErrorCode =
  | "opencode_timeout"
  | "opencode_no_text_output"
  | "provider_quota_exceeded"
  | "provider_rate_limited"
  | "provider_auth_error"
  | "opencode_worker_failed";

export type WorkerErrorResponse = {
  ok: false;
  error: string;
  details?: string[];
  code?: WorkerErrorCode;
  provider?: string;
};

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

export type WorkerStreamEvent =
  | OpenCodeTraceEvent
  | { type: "final"; result: WorkerResponse }
  | { type: "error"; error: WorkerErrorResponse };

export class NdjsonParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NdjsonParseError";
  }
}

export class NdjsonLineParser<T> {
  private buffer = "";

  push(chunk: string): T[] {
    this.buffer += chunk;
    const lines = this.buffer.split("\n");
    this.buffer = lines.pop() ?? "";

    return this.parseLines(lines);
  }

  flush(): T[] {
    const line = this.buffer;
    this.buffer = "";

    return this.parseLines(line.trim() ? [line] : []);
  }

  private parseLines(lines: string[]) {
    const values: T[] = [];

    for (const line of lines) {
      if (!line.trim()) {
        continue;
      }

      try {
        values.push(JSON.parse(line) as T);
      } catch (error) {
        throw new NdjsonParseError(error instanceof Error ? error.message : "Failed to parse NDJSON line.");
      }
    }

    return values;
  }
}

export function encodeNdjsonEvent(event: unknown) {
  return `${JSON.stringify(event)}\n`;
}
