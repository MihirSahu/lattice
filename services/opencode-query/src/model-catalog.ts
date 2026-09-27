import { DEFAULT_MODEL_ID } from "@lattice/model-catalog";
export { DEFAULT_MODEL_ID, DEFAULT_OPENAI_ROUTE } from "@lattice/model-catalog";

export function resolveOpenCodeModelSelection() {
  return {
    providerID: "openrouter" as const,
    modelID: DEFAULT_MODEL_ID,
    configModel: `openrouter/${DEFAULT_MODEL_ID}`
  };
}
