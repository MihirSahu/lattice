"use client";

import { useEffect, useState, useRef } from "react";
import { AlertCircle, CheckCircle2, ChevronDown, ChevronRight, CircleDashed, Clock3, FileText, FolderTree, Hammer, LoaderCircle, Search, Sparkles, Terminal } from "lucide-react";
import { LoadingDots } from "@/components/ui/loading-dots";
import { cn } from "@/lib/utils";
import type { PendingAssistantStreamState, ReasoningTraceEntry, TraceFileReference } from "@/lib/schemas";

type ReasoningStatusProps = {
  stream: PendingAssistantStreamState | null | undefined;
  complete?: boolean;
  defaultCollapsed?: boolean;
};

function getEntryIcon(entry: ReasoningTraceEntry) {
  if (entry.type === "tool_error") {
    return <AlertCircle className="h-3.5 w-3.5" />;
  }

  if (entry.type === "tool_finish") {
    return <CheckCircle2 className="h-3.5 w-3.5" />;
  }

  if (entry.type.startsWith("tool_")) {
    return <Hammer className="h-3.5 w-3.5" />;
  }

  if (entry.type === "file_access") {
    return <FileText className="h-3.5 w-3.5" />;
  }

  if (entry.type === "thinking") {
    return <Sparkles className="h-3.5 w-3.5" />;
  }

  return <CircleDashed className="h-3.5 w-3.5" />;
}

function formatElapsed(elapsedMs: number) {
  if (elapsedMs < 1000) {
    return `${elapsedMs}ms`;
  }

  return `${(elapsedMs / 1000).toFixed(1)}s`;
}

function formatFileOperation(file: TraceFileReference) {
  if (file.operation === "search") {
    return "searched";
  }

  if (file.operation === "list") {
    return "listed";
  }

  if (file.operation === "command") {
    return "command";
  }

  if (file.operation === "write") {
    return "wrote";
  }

  if (file.operation === "read") {
    return "read";
  }

  return "used";
}

function getFileIcon(file: TraceFileReference) {
  if (file.operation === "search") {
    return <Search className="h-3.5 w-3.5" />;
  }

  if (file.operation === "list") {
    return <FolderTree className="h-3.5 w-3.5" />;
  }

  if (file.operation === "command") {
    return <Terminal className="h-3.5 w-3.5" />;
  }

  return <FileText className="h-3.5 w-3.5" />;
}

function formatFileRange(file: TraceFileReference) {
  if (file.lineStart == null && file.lineEnd == null) {
    return null;
  }

  if (file.lineStart != null && file.lineEnd != null) {
    return `${file.lineStart}-${file.lineEnd}`;
  }

  return String(file.lineStart ?? file.lineEnd);
}

function formatTokens(entry: ReasoningTraceEntry) {
  if (!entry.tokens) {
    return null;
  }

  const total = entry.tokens.input + entry.tokens.output + entry.tokens.reasoning;
  const cost = entry.cost != null ? ` · $${entry.cost.toFixed(4)}` : "";

  return `${total.toLocaleString()} tokens${cost}`;
}

export function ReasoningStatus({ stream, complete = false, defaultCollapsed = false }: ReasoningStatusProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const entriesScrollRef = useRef<HTMLDivElement | null>(null);
  const reasoningScrollRef = useRef<HTMLDivElement | null>(null);
  const entries = stream?.entries ?? [];
  const reasoningText = stream?.reasoningText ?? "";
  const files = stream?.files ?? [];
  const reasoningPreview = reasoningText.length > 1400 ? `...${reasoningText.slice(-1400)}` : reasoningText;
  const summary = `${entries.length} step${entries.length === 1 ? "" : "s"}${files.length ? ` · ${files.length} file${files.length === 1 ? "" : "s"}` : ""}`;

  useEffect(() => {
    if (entriesScrollRef.current) {
      entriesScrollRef.current.scrollTop = entriesScrollRef.current.scrollHeight;
    }
  }, [entries.length]);

  useEffect(() => {
    if (reasoningScrollRef.current) {
      reasoningScrollRef.current.scrollTop = reasoningScrollRef.current.scrollHeight;
    }
  }, [reasoningText]);

  return (
    <div className="space-y-4 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-panel)] px-5 py-4">
      <div className="flex items-center justify-between gap-4">
        <button
          type="button"
          className="flex min-w-0 items-center gap-3 text-left"
          onClick={() => setCollapsed((current) => !current)}
          aria-expanded={!collapsed}
        >
          {collapsed ? <ChevronRight className="h-4 w-4 shrink-0 text-[var(--text-quaternary)]" /> : <ChevronDown className="h-4 w-4 shrink-0 text-[var(--text-quaternary)]" />}
          {complete ? <CheckCircle2 className="h-4 w-4 shrink-0 text-[var(--text-quaternary)]" /> : <LoadingDots className="shrink-0" />}
          <span className="min-w-0">
            <span className="block truncate text-[14px] font-[600] text-[var(--text-secondary)]">OpenCode reasoning</span>
            {complete || collapsed ? <span className="block truncate text-[12px] text-[var(--text-quaternary)]">{summary}</span> : null}
          </span>
        </button>
        {!collapsed && stream?.activeTool ? (
          <span className="inline-flex min-w-0 max-w-[52%] items-center gap-2 rounded-full border border-[var(--border-subtle)] px-3 py-1 text-[12px] text-[var(--text-tertiary)]">
            <LoaderCircle className="h-3.5 w-3.5 shrink-0 animate-spin" />
            <span className="truncate">{stream.activeTool.toolName}: {stream.activeTool.inputSummary ?? stream.activeTool.label}</span>
          </span>
        ) : null}
      </div>

      {collapsed ? null : stream?.activeTool?.inputSummary || stream?.activeTool?.files?.length ? (
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-4 py-3">
          <div className="flex items-center gap-2 text-[12px] font-[600] uppercase tracking-[0.12em] text-[var(--text-quaternary)]">
            <Hammer className="h-3.5 w-3.5" />
            <span>{stream.activeTool.toolName}</span>
          </div>
          {stream.activeTool.inputSummary ? (
            <p className="mt-2 break-words linear-mono text-[12px] leading-[1.6] text-[var(--text-secondary)]">{stream.activeTool.inputSummary}</p>
          ) : null}
          {stream.activeTool.files?.length ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {stream.activeTool.files.slice(0, 6).map((file) => (
                <span key={`${file.operation}-${file.path}-${file.lineStart ?? ""}`} className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-[var(--border-subtle)] px-2.5 py-1 text-[12px] text-[var(--text-tertiary)]">
                  {getFileIcon(file)}
                  <span className="truncate">{file.path}</span>
                </span>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {collapsed ? null : stream?.error ? (
        <p className="rounded-xl border border-[rgba(196,92,71,0.25)] px-3 py-2 text-[13px] leading-[1.6] text-[var(--text-secondary)]">
          {stream.error}
        </p>
      ) : null}

      {collapsed ? null : files.length ? (
        <div className="space-y-2">
          <p className="text-[12px] font-[600] uppercase tracking-[0.12em] text-[var(--text-quaternary)]">Files touched</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {files.slice(-8).map((file) => {
              const range = formatFileRange(file);

              return (
                <div key={`${file.operation}-${file.path}-${file.lineStart ?? ""}-${file.lineEnd ?? ""}`} className="flex min-w-0 items-center gap-2 rounded-xl border border-[var(--border-subtle)] px-3 py-2 text-[12px] text-[var(--text-tertiary)]">
                  <span className="shrink-0 text-[var(--text-quaternary)]" aria-hidden="true">{getFileIcon(file)}</span>
                  <span className="min-w-0 flex-1 truncate">{file.path}</span>
                  <span className="shrink-0 text-[var(--text-quaternary)]">{formatFileOperation(file)}{range ? `:${range}` : ""}</span>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {collapsed ? null : <div ref={entriesScrollRef} className="max-h-52 space-y-2 overflow-y-auto pr-1">
        {entries.length ? (
          entries.map((entry) => (
            <div key={entry.id} className="flex items-start gap-2 text-[13px] leading-[1.55] text-[var(--text-tertiary)]">
              <span
                className={cn(
                  "mt-0.5 shrink-0 text-[var(--text-quaternary)]",
                  entry.type === "tool_error" ? "text-[rgb(196,92,71)]" : null
                )}
                aria-hidden="true"
              >
                {getEntryIcon(entry)}
              </span>
              <span className="min-w-0 flex-1 break-words">
                <span>{entry.toolName ? `${entry.toolName}: ` : ""}{entry.label}</span>
                {entry.inputSummary ? <span className="block linear-mono text-[12px] text-[var(--text-quaternary)]">{entry.inputSummary}</span> : null}
                {entry.outputSummary ? <span className="block text-[12px] text-[var(--text-quaternary)]">{entry.outputSummary}</span> : null}
                {formatTokens(entry) ? <span className="block text-[12px] text-[var(--text-quaternary)]">{formatTokens(entry)}</span> : null}
              </span>
              {entry.elapsedMs != null ? (
                <span className="inline-flex shrink-0 items-center gap-1 text-[12px] text-[var(--text-quaternary)]">
                  <Clock3 className="h-3 w-3" />
                  {formatElapsed(entry.elapsedMs)}
                </span>
              ) : null}
            </div>
          ))
        ) : (
          <p className="text-[13px] leading-[1.6] text-[var(--text-tertiary)]">Waiting for OpenCode activity...</p>
        )}
      </div>}

      {!collapsed && reasoningPreview ? (
        <div ref={reasoningScrollRef} className="max-h-52 overflow-y-auto rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-4 py-3">
          <p className="whitespace-pre-wrap linear-mono text-[12px] leading-[1.7] text-[var(--text-secondary)]">{reasoningPreview}</p>
        </div>
      ) : null}
    </div>
  );
}
