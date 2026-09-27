import catalog from "./catalog.json" with { type: "json" };

export const DEFAULT_MODEL_ID = "openai/gpt-6-luna";
export const DEFAULT_OPENAI_ROUTE = "openrouter";
export const OPENCODE_MODEL_IDS = Object.freeze(Object.keys(catalog));
export const OPENCODE_MODELS = Object.freeze(
  Object.entries(catalog).map(([id, model]) => Object.freeze({ id, ...model }))
);

export function isAllowedModelId(value) {
  return typeof value === "string" && OPENCODE_MODEL_IDS.includes(value);
}
