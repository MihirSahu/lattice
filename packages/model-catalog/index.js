import catalog from "./catalog.json" with { type: "json" };

export const DEFAULT_MODEL_ID = "openai/gpt-5.5";
export const DEFAULT_OPENAI_ROUTE = "openrouter";
export const OPENAI_ROUTES = Object.freeze(["subscription", "openrouter"]);
export const OPENCODE_MODEL_IDS = Object.freeze(Object.keys(catalog));
export const OPENCODE_MODELS = Object.freeze(
  Object.entries(catalog).map(([id, model]) => Object.freeze({ id, ...model }))
);

export function isAllowedModelId(value) {
  return typeof value === "string" && OPENCODE_MODEL_IDS.includes(value);
}

export function isOpenAiRoute(value) {
  return typeof value === "string" && OPENAI_ROUTES.includes(value);
}

export function resolveOpenAiRoute(value) {
  return isOpenAiRoute(value) ? value : DEFAULT_OPENAI_ROUTE;
}
