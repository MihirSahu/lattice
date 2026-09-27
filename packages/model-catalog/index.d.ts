import catalog from "./catalog.json" with { type: "json" };

export type AllowedModelId = keyof typeof catalog;
export type ModelOption = {
  readonly id: AllowedModelId;
  readonly label: string;
  readonly provider: string;
  readonly iconKey: string;
  readonly description: string;
};
export const DEFAULT_MODEL_ID: "openai/gpt-6-luna";
export const DEFAULT_OPENAI_ROUTE: "openrouter";
export const OPENCODE_MODEL_IDS: readonly [AllowedModelId, ...AllowedModelId[]];
export const OPENCODE_MODELS: readonly ModelOption[];
export function isAllowedModelId(value: unknown): value is AllowedModelId;
