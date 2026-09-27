import assert from "node:assert/strict";
import test from "node:test";
import { resolveOpenCodeModelSelection } from "../src/model-catalog.ts";

test("the only model is GPT-6 Luna via OpenRouter", () => {
  assert.deepEqual(resolveOpenCodeModelSelection(), {
    providerID: "openrouter", modelID: "openai/gpt-6-luna", configModel: "openrouter/openai/gpt-6-luna"
  });
});
