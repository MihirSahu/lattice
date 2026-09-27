import {
  DEFAULT_MODEL_ID,
  DEFAULT_OPENAI_ROUTE,
  OPENCODE_MODELS,
  isAllowedModelId,
  type AllowedModelId,
  type OpenAiRoute
} from "@lattice/model-catalog";

export {
  DEFAULT_OPENAI_ROUTE,
  OPENAI_ROUTES,
  isAllowedModelId,
  isOpenAiRoute,
  resolveOpenAiRoute,
  type AllowedModelId,
  type OpenAiRoute
} from "@lattice/model-catalog";

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
