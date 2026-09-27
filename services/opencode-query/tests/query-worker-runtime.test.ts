import assert from "node:assert/strict";
import test from "node:test";
import {
  assertOpenCodeResponseHasNoAssistantError,
  disabledSubagentTools,
  extractAnswer,
  getOpenCodeResponseDiagnostics,
  resolveOpenCodeRuntimeConfig
} from "../dist/query-worker.js";

test("Luna runtime requires OpenRouter and fixes model and tool-compatible reasoning", async () => {
  await assert.rejects(() => resolveOpenCodeRuntimeConfig({}), /OPENROUTER_API_KEY is not configured/);
  await assert.rejects(() => resolveOpenCodeRuntimeConfig({ OPENROUTER_API_KEY: "   " }), /OPENROUTER_API_KEY/);
  const runtime = await resolveOpenCodeRuntimeConfig({
    OPENROUTER_API_KEY: "local-test-key", OPENCODE_MODEL: "anthropic/claude-opus-4.6",
    OPENCODE_OPENAI_AUTH_FILE: "/nonexistent/auth.json"
  });
  assert.deepEqual(runtime.modelSelection, {
    providerID: "openrouter", modelID: "openai/gpt-6-luna", configModel: "openrouter/openai/gpt-6-luna"
  });
  assert.equal(runtime.config.model, runtime.config.small_model);
  assert.deepEqual(runtime.config.enabled_providers, ["openrouter"]);
  assert.deepEqual(runtime.config.provider?.openrouter.whitelist, ["openai/gpt-6-luna"]);
  assert.deepEqual(runtime.config.provider?.openrouter.models?.["openai/gpt-6-luna"].options?.reasoning, { effort: "none" });
  assert.deepEqual(runtime.config.tools, disabledSubagentTools);
});

test("assistant response errors become structured provider diagnostics", () => {
  const responseData = {
    info: {
      providerID: "openai",
      modelID: "gpt-5.5",
      finish: "error",
      error: {
        name: "ApiError",
        message: "model gpt-5.5 is not supported",
        statusCode: 400,
        isRetryable: false,
        responseBody: "secret response body should not appear"
      }
    },
    parts: []
  };

  assert.throws(
    () => assertOpenCodeResponseHasNoAssistantError(responseData),
    (error) => {
      assert(error instanceof Error);
      const response = (error as Error & { response?: unknown }).response as {
        ok: false;
        provider?: string;
        error: string;
        details?: string[];
      };
      assert.equal(response.provider, "openai");
      assert.match(response.error, /model gpt-5\.5 is not supported/);
      assert.deepEqual(response.details, [
        "OpenCode response provider: openai",
        "OpenCode response model: gpt-5.5",
        "OpenCode response finish: error",
        "OpenCode response parts: none",
        "OpenCode response error: ApiError",
        "OpenCode response error message: model gpt-5.5 is not supported",
        "OpenCode response status: 400",
        "OpenCode response retryable: false"
      ]);
      assert.doesNotMatch(JSON.stringify(response), /secret response body/);
      return true;
    }
  );
});

test("empty non-text responses include sanitized provider model and part diagnostics", () => {
  const responseData = {
    info: {
      providerID: "openai",
      modelID: "gpt-5.5",
      finish: "stop"
    },
    parts: [
      {
        type: "reasoning",
        text: "internal reasoning should not be used as the answer"
      },
      {
        type: "tool",
        state: {
          output: "tool output should not be used as the answer"
        }
      }
    ]
  };
  const diagnostics = getOpenCodeResponseDiagnostics(responseData);

  assert.throws(
    () => extractAnswer(responseData.parts, diagnostics),
    (error) => {
      assert(error instanceof Error);
      const response = (error as Error & { response?: unknown }).response as {
        ok: false;
        provider?: string;
        details?: string[];
      };
      assert.equal(response.provider, "openai");
      assert.deepEqual(response.details, [
        "OpenCode response provider: openai",
        "OpenCode response model: gpt-5.5",
        "OpenCode response finish: stop",
        "OpenCode response parts: reasoning:1, tool:1",
        "Provider message: OpenCode response did not include any text output.",
        "No final text output was returned."
      ]);
      assert.doesNotMatch(JSON.stringify(response), /internal reasoning|tool output/);
      return true;
    }
  );
});

test("response diagnostics omit token-like and response body values", () => {
  const diagnostics = getOpenCodeResponseDiagnostics({
    info: {
      providerID: "openai",
      modelID: "gpt-5.5",
      error: {
        name: "ApiError",
        message: "invalid request",
        responseBody: "sensitive-refresh-value sensitive-access-value sensitive-jwt-value"
      }
    },
    parts: []
  });

  const serialized = JSON.stringify(diagnostics);

  assert.doesNotMatch(serialized, /sensitive-refresh-value|sensitive-access-value|sensitive-jwt-value/);
  assert.match(serialized, /invalid request/);
});

test("extractAnswer still returns text answers", () => {
  assert.equal(
    extractAnswer([
      {
        type: "text",
        text: " The answer. "
      }
    ]),
    "The answer."
  );
});
