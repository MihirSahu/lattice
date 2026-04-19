const DEFAULT_MODEL_ID = "anthropic/claude-sonnet-4.6" as const;

const OPENCODE_MODELS = [
  {
    id: "anthropic/claude-sonnet-4.6",
    label: "Claude Sonnet 4.6",
    provider: "anthropic",
    iconKey: "claude",
    description: "Balanced default for coding, agents, and professional work."
  },
  {
    id: "openai/gpt-5",
    label: "GPT-5",
    provider: "openai",
    iconKey: "openai",
    description: "Strong general-purpose reasoning and coding."
  },
  {
    id: "google/gemini-2.5-pro",
    label: "Gemini 2.5 Pro",
    provider: "google",
    iconKey: "gemini",
    description: "Large-context reasoning and advanced technical tasks."
  },
  {
    id: "x-ai/grok-4",
    label: "Grok 4",
    provider: "x-ai",
    iconKey: "grok",
    description: "High-capacity reasoning with strong coding performance."
  }
] as const;

export type AllowedModelId = typeof OPENCODE_MODELS[number]["id"];

const allowedModelIds = new Set<string>(OPENCODE_MODELS.map((model) => model.id));

export function isAllowedModelId(value: unknown): value is AllowedModelId {
  return typeof value === "string" && allowedModelIds.has(value);
}

export function resolveDefaultModelId(value: unknown = process.env.OPENCODE_MODEL): AllowedModelId {
  return isAllowedModelId(value) ? value : DEFAULT_MODEL_ID;
}

export function resolveRequestedModelId(value: unknown, fallback = resolveDefaultModelId()): AllowedModelId {
  if (value == null || value === "") {
    return fallback;
  }

  if (!isAllowedModelId(value)) {
    throw new Error(`Unsupported OpenCode model: ${String(value)}`);
  }

  return value;
}

export function getModelCatalog(defaultModelId = resolveDefaultModelId()) {
  return OPENCODE_MODELS.map((model) => ({
    ...model,
    isDefault: model.id === defaultModelId
  }));
}

export function toOpenCodeModelIdentifier(modelId: AllowedModelId) {
  return `openrouter/${modelId}`;
}

