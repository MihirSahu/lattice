import assert from "node:assert/strict";
import test from "node:test";
import { resolveOpenAiRoute, resolveOpenCodeModelSelection, toOpenCodeModelIdentifier } from "../src/model-catalog.ts";

test("OpenAI models use the native OpenAI provider", () => {
  assert.deepEqual(resolveOpenCodeModelSelection("openai/gpt-5.5", "subscription"), {
    providerID: "openai",
    modelID: "gpt-5.5",
    configModel: "openai/gpt-5.5"
  });
  assert.equal(toOpenCodeModelIdentifier("openai/gpt-5.5"), "openai/gpt-5.5");
});

test("OpenAI models can route through OpenRouter", () => {
  assert.deepEqual(resolveOpenCodeModelSelection("openai/gpt-5.5", "openrouter"), {
    providerID: "openrouter",
    modelID: "openai/gpt-5.5",
    configModel: "openrouter/openai/gpt-5.5"
  });
  assert.equal(toOpenCodeModelIdentifier("openai/gpt-5.5", "openrouter"), "openrouter/openai/gpt-5.5");
});

test("non-OpenAI models continue to route through OpenRouter", () => {
  assert.deepEqual(resolveOpenCodeModelSelection("anthropic/claude-sonnet-4.6", "subscription"), {
    providerID: "openrouter",
    modelID: "anthropic/claude-sonnet-4.6",
    configModel: "openrouter/anthropic/claude-sonnet-4.6"
  });
  assert.deepEqual(resolveOpenCodeModelSelection("anthropic/claude-opus-4.6", "subscription"), {
    providerID: "openrouter",
    modelID: "anthropic/claude-opus-4.6",
    configModel: "openrouter/anthropic/claude-opus-4.6"
  });
  assert.equal(toOpenCodeModelIdentifier("google/gemini-2.5-pro"), "openrouter/google/gemini-2.5-pro");
});

test("invalid OpenAI routes default to subscription", () => {
  assert.equal(resolveOpenAiRoute("openrouter"), "openrouter");
  assert.equal(resolveOpenAiRoute("invalid"), "subscription");
});
