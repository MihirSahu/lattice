import catalog from "./catalog.json" with { type: "json" };

export type AllowedModelId = keyof typeof catalog;
export type OpenAiRoute = "subscription" | "openrouter";
export type ModelOption = {
  readonly id: AllowedModelId;
  readonly label: string;
  readonly provider: string;
  readonly iconKey: string;
  readonly description: string;
};
export const DEFAULT_MODEL_ID: AllowedModelId;
export const DEFAULT_OPENAI_ROUTE: OpenAiRoute;
export const OPENAI_ROUTES: readonly ["subscription", "openrouter"];
export const OPENCODE_MODEL_IDS: readonly [AllowedModelId, ...AllowedModelId[]];
export const OPENCODE_MODELS: readonly ModelOption[];
export function isAllowedModelId(value: unknown): value is AllowedModelId;
export function isOpenAiRoute(value: unknown): value is OpenAiRoute;
export function resolveOpenAiRoute(value: unknown): OpenAiRoute;
