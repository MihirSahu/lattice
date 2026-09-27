"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";
import { AssistantAnswerMarkdown } from "@/components/assistant-answer-markdown";
import { ModelMark } from "@/components/model-icons";
import { ReasoningStatus } from "@/components/reasoning-status";
import { Button } from "@/components/ui/button";
import { copyTextToClipboard } from "@/lib/clipboard";
import type { ChatMessage } from "@/lib/schemas";

type ChatMessageListProps = {
  messages: ChatMessage[];
};

function formatDuration(durationMs: number) {
  if (durationMs < 1000) {
    return `${Math.round(durationMs)}ms`;
  }

  if (durationMs < 60_000) {
    return `${(durationMs / 1000).toFixed(1)}s`;
  }

  const totalSeconds = Math.round(durationMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
}

export function ChatMessageList({ messages }: ChatMessageListProps) {
  const [copiedState, setCopiedState] = useState<{ id: string; kind: "prompt" | "response" } | null>(null);
  const copiedStateTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (copiedStateTimeoutRef.current !== null) {
        window.clearTimeout(copiedStateTimeoutRef.current);
      }
    };
  }, []);

  async function handleCopy(id: string, kind: "prompt" | "response", value: string) {
    const copied = await copyTextToClipboard(value);

    if (!copied) {
      return;
    }

    setCopiedState({ id, kind });

    if (copiedStateTimeoutRef.current !== null) {
      window.clearTimeout(copiedStateTimeoutRef.current);
    }

    copiedStateTimeoutRef.current = window.setTimeout(() => {
      setCopiedState((current) => (current?.id === id && current.kind === kind ? null : current));
    }, 1500);
  }

  function isCopied(id: string, kind: "prompt" | "response") {
    return copiedState?.id === id && copiedState.kind === kind;
  }

  return (
    <div className="mx-auto flex min-w-0 w-full max-w-[860px] flex-col gap-10 pb-4 sm:pb-6">
      {messages.map((message) => {
        if (message.role === "user") {
          return (
            <section key={message.id} className="ml-auto min-w-0 w-full max-w-[88%] space-y-2 text-right lg:max-w-[78%]">
              <div className="flex items-center justify-end gap-2">
                <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-(--text-quaternary)">Prompt</p>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0 rounded-full text-(--text-quaternary) hover:bg-(--bg-button-subtle) hover:text-(--text-primary)"
                  onClick={() => handleCopy(message.id, "prompt", message.question ?? "")}
                  aria-label="Copy prompt"
                >
                  {isCopied(message.id, "prompt") ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              <p className="wrap-break-word whitespace-pre-wrap text-[15px] leading-[1.75] text-(--text-primary)">{message.question}</p>
            </section>
          );
        }

        if (message.pending) {
          return (
            <section key={message.id} className="min-w-0 w-full">
              <ReasoningStatus stream={message.stream} />
            </section>
          );
        }

        if (message.error) {
          return (
            <section key={message.id} className="min-w-0 w-full">
              <div className="rounded-2xl border border-[rgba(196,92,71,0.25)] bg-(--bg-panel) px-5 py-4">
                <div className="space-y-2">
                  <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-(--text-quaternary)">Assistant error</p>
                  <p className="wrap-break-word text-[15px] leading-[1.7] text-(--text-secondary)">{message.error}</p>
                  {message.errorDetails?.length ? (
                    <details className="pt-1">
                      <summary className="cursor-pointer text-[13px] text-(--text-tertiary)">Show details</summary>
                      <div className="mt-3 rounded-2xl border border-(--border-subtle) bg-(--bg-surface) px-4 py-3">
                        <ul className="space-y-1.5">
                          {message.errorDetails.map((detail, index) => (
                            <li key={`${message.id}-detail-${index}`} className="wrap-break-word linear-mono text-[12px] leading-[1.6] text-(--text-secondary)">
                              {detail}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </details>
                  ) : null}
                </div>
              </div>
            </section>
          );
        }

        if (!message.response) {
          return null;
        }

        const answer = message.response;

        return (
          <section key={message.id} className="min-w-0 w-full space-y-6">
            {message.stream ? <ReasoningStatus stream={message.stream} complete defaultCollapsed /> : null}

            <div className="min-w-0 space-y-2">
              <div className="flex items-center gap-2">
                <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-(--text-quaternary)">Answer</p>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0 rounded-full text-(--text-quaternary) hover:bg-(--bg-button-subtle) hover:text-(--text-primary)"
                  onClick={() => handleCopy(message.id, "response", answer.answer)}
                  aria-label="Copy response"
                >
                  {isCopied(message.id, "response") ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              <AssistantAnswerMarkdown>{answer.answer}</AssistantAnswerMarkdown>
            </div>

            <div className="flex flex-wrap items-center gap-2 border-t border-(--border-subtle) pt-4 text-[13px] text-(--text-tertiary)">
              <span>{answer.backend === "opencode" ? "OpenCode" : "Archived answer"}</span>
              <span aria-hidden="true">·</span>
              <span>{answer.folder ?? "All Sources"}</span>
              {answer.backend === "opencode" && answer.model ? <span aria-hidden="true">·</span> : null}
              {answer.backend === "opencode" && answer.model ? (
                <span className="inline-flex min-w-0 items-center gap-2">
                  <ModelMark backend={answer.backend} model={answer.model} fallback="bot" className="h-4 w-4 shrink-0 text-(--text-tertiary)" />
                  <span className="linear-mono truncate">{answer.model}</span>
                </span>
              ) : null}
              {answer.duration_ms != null ? <span aria-hidden="true">·</span> : null}
              {answer.duration_ms != null ? <span>{formatDuration(answer.duration_ms)}</span> : null}
            </div>
          </section>
        );
      })}
    </div>
  );
}
