"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

type AssistantAnswerMarkdownProps = {
  children: string;
  className?: string;
};

export function AssistantAnswerMarkdown({ children, className }: AssistantAnswerMarkdownProps) {
  return (
    <div className={cn("answer-markdown", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ node: _node, className: headingClassName, ...props }) => (
            <h1 className={cn("text-[28px] font-[650] leading-[1.15] tracking-[-0.02em] text-[var(--text-primary)]", headingClassName)} {...props} />
          ),
          h2: ({ node: _node, className: headingClassName, ...props }) => (
            <h2 className={cn("text-[22px] font-[650] leading-[1.2] tracking-[-0.015em] text-[var(--text-primary)]", headingClassName)} {...props} />
          ),
          h3: ({ node: _node, className: headingClassName, ...props }) => (
            <h3 className={cn("text-[18px] font-[650] leading-[1.3] text-[var(--text-primary)]", headingClassName)} {...props} />
          ),
          p: ({ node: _node, className: paragraphClassName, ...props }) => (
            <p className={cn("text-[16px] leading-[1.75] text-[var(--text-primary)]", paragraphClassName)} {...props} />
          ),
          ul: ({ node: _node, className: listClassName, ...props }) => (
            <ul className={cn("list-disc space-y-2 pl-5 text-[16px] leading-[1.7] text-[var(--text-primary)]", listClassName)} {...props} />
          ),
          ol: ({ node: _node, className: listClassName, ...props }) => (
            <ol className={cn("list-decimal space-y-2 pl-5 text-[16px] leading-[1.7] text-[var(--text-primary)]", listClassName)} {...props} />
          ),
          li: ({ node: _node, className: itemClassName, ...props }) => (
            <li className={cn("pl-1", itemClassName)} {...props} />
          ),
          strong: ({ node: _node, className: strongClassName, ...props }) => (
            <strong className={cn("font-[650] text-[var(--text-primary)]", strongClassName)} {...props} />
          ),
          em: ({ node: _node, className: emphasisClassName, ...props }) => (
            <em className={cn("italic text-[var(--text-primary)]", emphasisClassName)} {...props} />
          ),
          blockquote: ({ node: _node, className: quoteClassName, ...props }) => (
            <blockquote
              className={cn(
                "border-l-2 border-[var(--border-subtle)] pl-4 text-[16px] italic leading-[1.75] text-[var(--text-secondary)]",
                quoteClassName
              )}
              {...props}
            />
          ),
          code: ({ node: _node, className: codeClassName, children: codeChildren, ...props }) => {
            const isBlock = Boolean(codeClassName?.includes("language-"));

            if (isBlock) {
              return (
                <code
                  className={cn(
                    "block overflow-x-auto rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-4 py-3 text-[14px] leading-[1.65] text-[var(--text-primary)]",
                    codeClassName
                  )}
                  {...props}
                >
                  {codeChildren}
                </code>
              );
            }

            return (
              <code
                className={cn(
                  "linear-mono rounded-md bg-[var(--bg-surface)] px-1.5 py-0.5 text-[0.92em] text-[var(--text-primary)]",
                  codeClassName
                )}
                {...props}
              >
                {codeChildren}
              </code>
            );
          },
          pre: ({ node: _node, className: preClassName, ...props }) => <pre className={cn("my-0", preClassName)} {...props} />,
          a: ({ node: _node, className: anchorClassName, ...props }) => (
            <a
              className={cn(
                "underline decoration-[var(--border-strong)] underline-offset-4 transition-colors hover:text-[var(--text-primary)]",
                anchorClassName
              )}
              target="_blank"
              rel="noreferrer"
              {...props}
            />
          )
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
