import type { ReactNode } from "react";
import { Anthropic, Gemini, Grok, OpenAI } from "@lobehub/icons";
import { Bot } from "lucide-react";

type ModelAvatarProps = {
  backend?: string;
  model?: string;
  iconKey?: "claude" | "openai" | "gemini" | "grok";
  className?: string;
};

function avatarShell(child: ReactNode, className?: string) {
  return (
    <div
      className={className ?? "mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)]"}
    >
      {child}
    </div>
  );
}

function resolveModelIcon(model?: string, iconKey?: ModelAvatarProps["iconKey"], className = "h-4 w-4 text-[var(--text-primary)]") {
  if (iconKey === "claude") {
    return <Anthropic size="1em" className={className} />;
  }

  if (iconKey === "openai") {
    return <OpenAI size="1em" className={className} />;
  }

  if (iconKey === "gemini") {
    return <Gemini size="1em" className={className} />;
  }

  if (iconKey === "grok") {
    return <Grok size="1em" className={className} />;
  }

  if (!model) {
    return null;
  }

  if (model.startsWith("anthropic/")) {
    return <Anthropic size="1em" className={className} />;
  }

  if (model.startsWith("openai/")) {
    return <OpenAI size="1em" className={className} />;
  }

  if (model.startsWith("google/")) {
    return <Gemini size="1em" className={className} />;
  }

  if (model.startsWith("x-ai/")) {
    return <Grok size="1em" className={className} />;
  }

  return null;
}

type ModelMarkProps = ModelAvatarProps & {
  fallback?: "bot" | "none";
};

export function ModelMark({ backend, model, iconKey, className, fallback = "bot" }: ModelMarkProps) {
  if (backend !== "opencode") {
    if (fallback === "none") {
      return null;
    }

    return <Bot className={className ?? "h-4 w-4 text-[var(--text-primary)]"} />;
  }

  const icon = resolveModelIcon(model, iconKey, className ?? "h-4 w-4 text-[var(--text-primary)]");

  if (!icon) {
    if (fallback === "none") {
      return null;
    }

    return <Bot className={className ?? "h-4 w-4 text-[var(--text-primary)]"} />;
  }

  return icon;
}

export function ModelAvatar({ backend, model, iconKey, className }: ModelAvatarProps) {
  if (backend !== "opencode") {
    return avatarShell(<Bot className="h-4 w-4 text-[var(--text-primary)]" />, className);
  }

  const icon = <ModelMark backend={backend} model={model} iconKey={iconKey} className="h-4 w-4 text-[var(--text-primary)]" />;

  return avatarShell(icon, className);
}
