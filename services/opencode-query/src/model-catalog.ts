const DEFAULT_MODEL_ID = "openai/gpt-5.5" as const;
export const DEFAULT_OPENAI_ROUTE = "subscription" as const;
export const OPENAI_ROUTES = ["subscription", "openrouter"] as const;

const OPENCODE_MODELS = [
  {
    id: "anthropic/claude-sonnet-4.6",
    label: "Claude Sonnet 4.6",
    provider: "anthropic",
    iconKey: "claude",
    description: "Balanced default for coding, agents, and professional work."
  },
  {
    id: "anthropic/claude-opus-4.6",
    label: "Claude Opus 4.6",
    provider: "anthropic",
    iconKey: "claude",
    description: "Anthropic's strongest model for deeper coding and long-running analysis."
  },
  {
    id: "openai/gpt-5.5",
    label: "GPT-5.5",
    provider: "openai",
    iconKey: "openai",
    description: "Latest OpenAI model available through ChatGPT OAuth when supported."
  },
  {
    id: "google/gemini-2.5-pro",
    label: "Gemini 2.5 Pro",
    provider: "google",
    iconKey: "gemini",
    description: "Large-context reasoning and advanced technical tasks."
  }
] as const;

export type AllowedModelId = typeof OPENCODE_MODELS[number]["id"];
export type OpenAiRoute = typeof OPENAI_ROUTES[number];

const allowedModelIds = new Set<string>(OPENCODE_MODELS.map((model) => model.id));
const openAiRoutes = new Set<string>(OPENAI_ROUTES);

export function isAllowedModelId(value: unknown): value is AllowedModelId {
  return typeof value === "string" && allowedModelIds.has(value);
}

export function isOpenAiRoute(value: unknown): value is OpenAiRoute {
  return typeof value === "string" && openAiRoutes.has(value);
}

export function resolveOpenAiRoute(value: unknown): OpenAiRoute {
  return isOpenAiRoute(value) ? value : DEFAULT_OPENAI_ROUTE;
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

export type OpenCodeModelSelection = {
  providerID: "openai" | "openrouter";
  modelID: string;
  configModel: string;
};

export function toOpenCodeModelIdentifier(modelId: AllowedModelId, openAiRoute: OpenAiRoute = DEFAULT_OPENAI_ROUTE) {
  return resolveOpenCodeModelSelection(modelId, openAiRoute).configModel;
}

export function resolveOpenCodeModelSelection(
  modelId: AllowedModelId,
  openAiRoute: OpenAiRoute = DEFAULT_OPENAI_ROUTE
): OpenCodeModelSelection {
  if (modelId.startsWith("openai/") && openAiRoute === "subscription") {
    return {
      providerID: "openai",
      modelID: modelId.slice("openai/".length),
      configModel: modelId
    };
  }

  return {
    providerID: "openrouter",
    modelID: modelId,
    configModel: `openrouter/${modelId}`
  };
}
