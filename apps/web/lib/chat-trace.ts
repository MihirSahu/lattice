import type { OpenCodeTraceEvent } from "./chat-stream.ts";
import type {
  ActiveToolState,
  PendingAssistantStreamState,
  ReasoningTraceEntry,
  TraceFileReference
} from "./schemas.ts";

export function createPendingAssistantStreamState(): PendingAssistantStreamState {
  return {
    entries: [],
    activeTool: null,
    reasoningText: "",
    files: [],
    error: null
  };
}

function getTraceEntryLabel(event: OpenCodeTraceEvent) {
  if (event.type === "status" || event.type === "thinking") {
    return event.message;
  }

  if (event.type === "session") {
    return `Session started: ${event.model}`;
  }

  if (event.type === "tool_start" || event.type === "tool_finish" || event.type === "tool_error") {
    return event.label;
  }

  if (event.type === "tool_progress") {
    return event.message;
  }

  if (event.type === "file_access") {
    return event.label;
  }

  return "";
}

function appendTraceEntry(
  stream: PendingAssistantStreamState,
  event: Exclude<OpenCodeTraceEvent, { type: "reasoning_delta" }>
): PendingAssistantStreamState {
  const label = getTraceEntryLabel(event);
  const entry: ReasoningTraceEntry = {
    id: `${Date.now()}-${stream.entries.length}`,
    type: event.type,
    label,
    createdAt: new Date().toISOString(),
    toolName: "toolName" in event ? event.toolName : undefined,
    toolUseId: "toolUseId" in event ? event.toolUseId : undefined,
    status: event.status,
    inputSummary: event.inputSummary,
    outputSummary: event.outputSummary,
    elapsedMs: event.elapsedMs,
    files: event.files,
    tokens: event.tokens,
    cost: event.cost,
    error: event.error
  };

  return {
    ...stream,
    entries: [...stream.entries, entry].slice(-80)
  };
}

function mergeTraceFiles(currentFiles: TraceFileReference[], nextFiles: TraceFileReference[] | undefined) {
  if (!nextFiles?.length) {
    return currentFiles;
  }

  const byKey = new Map<string, TraceFileReference>();

  for (const file of [...currentFiles, ...nextFiles]) {
    byKey.set(`${file.operation}:${file.path}:${file.lineStart ?? ""}:${file.lineEnd ?? ""}`, file);
  }

  return Array.from(byKey.values()).slice(-40);
}

export function applyStreamEventToState(
  stream: PendingAssistantStreamState,
  event: OpenCodeTraceEvent
): PendingAssistantStreamState {
  if (event.type === "reasoning_delta") {
    return {
      ...stream,
      reasoningText: `${stream.reasoningText}${event.text}`
    };
  }

  let nextStream = appendTraceEntry(stream, event);

  if (event.type === "tool_start") {
    const activeTool: ActiveToolState = {
      toolName: event.toolName,
      toolUseId: event.toolUseId,
      label: event.label,
      startedAt: new Date().toISOString(),
      inputSummary: event.inputSummary,
      files: event.files
    };
    nextStream = {
      ...nextStream,
      activeTool
    };
  }

  if (event.type === "tool_finish" || event.type === "tool_error") {
    nextStream = {
      ...nextStream,
      activeTool: nextStream.activeTool?.toolUseId === event.toolUseId ? null : nextStream.activeTool,
      error: event.type === "tool_error" ? event.label : nextStream.error
    };
  }

  return {
    ...nextStream,
    files: mergeTraceFiles(nextStream.files, event.files)
  };
}

export function finalizeAssistantStreamState(stream: PendingAssistantStreamState): PendingAssistantStreamState {
  return {
    ...stream,
    activeTool: null
  };
}

export function hasAssistantStreamContent(
  stream: PendingAssistantStreamState | null | undefined
): stream is PendingAssistantStreamState {
  return Boolean(
    stream &&
      (stream.entries.length > 0 ||
        stream.files.length > 0 ||
        stream.reasoningText.trim() ||
        stream.error)
  );
}
