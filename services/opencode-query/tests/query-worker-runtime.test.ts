import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  assertOpenCodeResponseHasNoAssistantError,
  disabledSubagentTools,
  extractAnswer,
  getOpenCodeResponseDiagnostics,
  resolveOpenCodeRuntimeConfig,
  setOpenAiAuth
} from "../dist/query-worker.js";

const openAiAuth = {
  type: "oauth",
  refresh: "refresh-secret",
  access: "access-secret",
  expires: 1777769584483
} as const;

test("OpenAI runtime config does not require OPENROUTER_API_KEY", async () => {
  const home = await mkdtemp(join(tmpdir(), "opencode-runtime-home-"));
  const authPath = join(home, "auth.json");
  await writeFile(authPath, JSON.stringify(openAiAuth));
  const runtime = await resolveOpenCodeRuntimeConfig("openai/gpt-5.5", "subscription", {
    OPENCODE_OPENAI_AUTH_FILE: authPath,
    HOME: home
  });

  assert.deepEqual(runtime.modelSelection, {
    providerID: "openai",
    modelID: "gpt-5.5",
    configModel: "openai/gpt-5.5"
  });
  assert.equal(runtime.config.model, "openai/gpt-5.5");
  assert.deepEqual(runtime.config.enabled_providers, ["openai"]);
  assert.deepEqual(runtime.config.tools, disabledSubagentTools);
  assert.deepEqual(runtime.config.agent?.general?.tools, disabledSubagentTools);
  assert.equal(runtime.openAiAuth?.source, "file");
});

test("OpenRouter runtime config still requires OPENROUTER_API_KEY", async () => {
  await assert.rejects(
    () => resolveOpenCodeRuntimeConfig("anthropic/claude-sonnet-4.6", "subscription", {}),
    /OPENROUTER_API_KEY is not configured/
  );

  const runtime = await resolveOpenCodeRuntimeConfig("anthropic/claude-sonnet-4.6", "subscription", {
    OPENROUTER_API_KEY: "openrouter-secret"
  });

  assert.deepEqual(runtime.modelSelection, {
    providerID: "openrouter",
    modelID: "anthropic/claude-sonnet-4.6",
    configModel: "openrouter/anthropic/claude-sonnet-4.6"
  });
  assert.equal(runtime.config.provider.openrouter.options.apiKey, "openrouter-secret");
  assert.deepEqual(runtime.config.tools, disabledSubagentTools);
  assert.deepEqual(runtime.config.agent?.general?.tools, disabledSubagentTools);
});

test("OpenAI models can use OpenRouter runtime config", async () => {
  const runtime = await resolveOpenCodeRuntimeConfig("openai/gpt-5.5", "openrouter", {
    OPENROUTER_API_KEY: "openrouter-secret"
  });

  assert.deepEqual(runtime.modelSelection, {
    providerID: "openrouter",
    modelID: "openai/gpt-5.5",
    configModel: "openrouter/openai/gpt-5.5"
  });
  assert.equal(runtime.config.model, "openrouter/openai/gpt-5.5");
  assert.deepEqual(runtime.config.enabled_providers, ["openrouter"]);
  assert.equal(runtime.openAiAuth, null);
});

test("setOpenAiAuth writes credentials through the OpenCode auth endpoint", async () => {
  const calls: unknown[] = [];
  const client = {
    auth: {
      set: async (payload: unknown) => {
        calls.push(payload);
        return true;
      }
    }
  };

  await setOpenAiAuth(
    client as Parameters<typeof setOpenAiAuth>[0],
    {
      auth: openAiAuth,
      source: "file",
      expires: openAiAuth.expires
    },
    "test-request"
  );

  assert.deepEqual(calls, [
    {
      responseStyle: "data",
      throwOnError: true,
      path: {
        id: "openai"
      },
      query: {
        directory: process.cwd()
      },
      body: openAiAuth
    }
  ]);
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
