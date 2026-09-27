import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_MODEL_ID, DEFAULT_OPENAI_ROUTE } from "@lattice/model-catalog";
import { createPendingAssistantStreamState } from "../lib/chat-trace.ts";
import {
  createDraftThreadSettings,
  getChatCacheStorageKey,
  getChatUiStorageKey,
  loadLocalChatCache,
  loadLocalChatUiState,
  normalizeOpenAiRoute,
  normalizeOpencodeModel,
  saveLocalChatCache,
  saveLocalChatUiState,
  shouldShowOpenAiRouteToggle,
  toDisplayMessages
} from "../lib/chat-local-state.ts";

type StorageMap = Map<string, string>;

test("cached QMD conversations continue through OpenRouter without rewriting historical answers", () => {
  withMockWindow((store) => {
    const thread = {
      id: "8774e6dc-6560-4107-aab6-76e0d34c97dc",
      title: "Archived conversation",
      engine: "qmd",
      folder: "notes",
      model: null,
      openAiRoute: null,
      createdAt: "2026-04-20T12:00:00.000Z",
      updatedAt: "2026-04-20T12:00:05.000Z"
    };
    const messages = [{ id: "historic-answer", role: "assistant", response: { backend: "qmd", answer: "Original answer" } }];
    store.set(getChatCacheStorageKey("alice@example.com"), JSON.stringify({
      threadSummaries: [thread],
      lastThreadDetail: { ...thread, messages },
      cachedAt: "2026-04-20T12:00:05.000Z"
    }));
    const cache = loadLocalChatCache("alice@example.com");
    for (const loaded of [cache?.threadSummaries[0], cache?.lastThreadDetail]) {
      assert.equal(loaded?.engine, "opencode");
      assert.equal(loaded?.model, DEFAULT_MODEL_ID);
      assert.equal(loaded?.openAiRoute, DEFAULT_OPENAI_ROUTE);
      assert.equal(loaded?.folder, "notes");
    }
    assert.deepEqual(cache?.lastThreadDetail?.messages, messages);
  });
});

test("saved QMD drafts reopen with the API model default and preserve the question", () => {
  withMockWindow((store) => {
    store.set(getChatUiStorageKey("alice@example.com"), JSON.stringify({
      draftQuestion: "An unfinished question",
      draftThreadSettings: { engine: "qmd", folder: "notes", model: "anthropic/claude-sonnet-4.6", openAiRoute: "subscription" }
    }));
    const state = loadLocalChatUiState("alice@example.com");
    assert.equal(state.draftThreadSettings.engine, "opencode");
    assert.equal(state.draftThreadSettings.model, DEFAULT_MODEL_ID);
    assert.equal(state.draftThreadSettings.openAiRoute, DEFAULT_OPENAI_ROUTE);
    assert.equal(state.draftThreadSettings.folder, "notes");
    assert.equal(state.draftQuestion, "An unfinished question");
  });
});

function createMockStorage(store: StorageMap) {
  return {
    getItem(key: string) {
      return store.has(key) ? store.get(key)! : null;
    },
    setItem(key: string, value: string) {
      store.set(key, value);
    },
    removeItem(key: string) {
      store.delete(key);
    }
  };
}

function withMockWindow(callback: (store: StorageMap) => void) {
  const originalWindow = globalThis.window;
  const store: StorageMap = new Map();

  globalThis.window = {
    localStorage: createMockStorage(store)
  } as Window & typeof globalThis;

  try {
    callback(store);
  } finally {
    globalThis.window = originalWindow;
  }
}

test("chat local state namespaces cache keys by normalized user email", () => {
  assert.equal(
    getChatCacheStorageKey("Alice@Example.com"),
    "lattice-chat-cache-v3:alice@example.com"
  );
  assert.equal(
    getChatUiStorageKey("Alice@Example.com"),
    "lattice-chat-ui-v3:alice@example.com"
  );
});

test("chat local state keeps cache snapshots isolated per user", () => {
  withMockWindow(() => {
    saveLocalChatCache("alice@example.com", {
      threadSummaries: [
        {
          id: "8774e6dc-6560-4107-aab6-76e0d34c97dc",
          title: "Alice thread",
          createdAt: "2026-04-20T12:00:00.000Z",
          updatedAt: "2026-04-20T12:00:05.000Z",
          engine: "opencode",
          folder: "",
          model: null
        }
      ],
      lastThreadDetail: null,
      cachedAt: "2026-04-20T12:00:05.000Z"
    });

    saveLocalChatCache("bob@example.com", {
      threadSummaries: [
        {
          id: "ed34626a-9ab6-4ad9-861d-f5f37737565e",
          title: "Bob thread",
          createdAt: "2026-04-20T12:00:10.000Z",
          updatedAt: "2026-04-20T12:00:15.000Z",
          engine: "opencode",
          folder: "notes",
          model: "openai/gpt-5.5",
          openAiRoute: "subscription"
        }
      ],
      lastThreadDetail: null,
      cachedAt: "2026-04-20T12:00:15.000Z"
    });

    const aliceCache = loadLocalChatCache("alice@example.com");
    const bobCache = loadLocalChatCache("bob@example.com");

    assert.equal(aliceCache?.threadSummaries[0]?.title, "Alice thread");
    assert.equal(bobCache?.threadSummaries[0]?.title, "Bob thread");
  });
});

test("chat local state keeps UI state isolated per user", () => {
  withMockWindow(() => {
    saveLocalChatUiState("alice@example.com", {
      selectedThreadId: "8774e6dc-6560-4107-aab6-76e0d34c97dc",
      draftQuestion: "Alice draft",
      draftThreadSettings: createDraftThreadSettings("openai/gpt-5.5"),
      sidebarCollapsed: true
    });

    const bobUiState = loadLocalChatUiState("bob@example.com", "openai/gpt-5.5");

    assert.equal(bobUiState.selectedThreadId, null);
    assert.equal(bobUiState.draftQuestion, "");
    assert.deepEqual(bobUiState.draftThreadSettings, createDraftThreadSettings("openai/gpt-5.5"));
    assert.equal(bobUiState.sidebarCollapsed, false);
  });
});

test("chat local state upgrades saved legacy default OpenCode models", () => {
  withMockWindow((store) => {
    store.set(
      getChatUiStorageKey("alice@example.com"),
      JSON.stringify({
        selectedThreadId: null,
        draftQuestion: "Saved draft",
        draftThreadSettings: {
          engine: "opencode",
          folder: "",
          model: "openai/gpt-5",
          openAiRoute: "subscription"
        },
        sidebarCollapsed: false
      })
    );

    const state = loadLocalChatUiState("alice@example.com", "openai/gpt-5.5");

    assert.equal(state.draftThreadSettings.model, "openai/gpt-5.5");
    assert.equal(state.draftThreadSettings.openAiRoute, "subscription");
  });
});

test("chat local state hydrates saved OpenAI route for GPT models", () => {
  withMockWindow((store) => {
    store.set(
      getChatUiStorageKey("alice@example.com"),
      JSON.stringify({
        selectedThreadId: null,
        draftQuestion: "Saved draft",
        draftThreadSettings: {
          ...createDraftThreadSettings("openai/gpt-5.5"),
          openAiRoute: "openrouter"
        },
        sidebarCollapsed: false
      })
    );

    const state = loadLocalChatUiState("alice@example.com", "openai/gpt-5.5");

    assert.equal(state.draftThreadSettings.model, "openai/gpt-5.5");
    assert.equal(state.draftThreadSettings.openAiRoute, "openrouter");
  });
});

test("OpenAI route normalization applies only to OpenAI models", () => {
  assert.equal(normalizeOpenAiRoute("openrouter", "openai/gpt-5.5"), "openrouter");
  assert.equal(normalizeOpenAiRoute("invalid", "openai/gpt-5.5"), "openrouter");
  assert.equal(normalizeOpenAiRoute("openrouter", "anthropic/claude-sonnet-4.6"), "openrouter");
  assert.equal(normalizeOpenAiRoute("openrouter", "anthropic/claude-opus-4.6"), "openrouter");
});

test("OpenAI route toggle is visible only for OpenCode GPT models", () => {
  assert.equal(shouldShowOpenAiRouteToggle("openai/gpt-5.5"), true);
  assert.equal(shouldShowOpenAiRouteToggle("anthropic/claude-sonnet-4.6"), false);
  assert.equal(shouldShowOpenAiRouteToggle("anthropic/claude-opus-4.6"), false);
});

test("normalizeOpencodeModel upgrades legacy GPT-5 even when explicitly requested", () => {
  assert.equal(normalizeOpencodeModel("openai/gpt-5", "openai/gpt-5.5"), "openai/gpt-5.5");
  assert.equal(
    normalizeOpencodeModel("openai/gpt-5", "openai/gpt-5.5", { upgradeLegacyDefault: false }),
    "openai/gpt-5.5"
  );
  assert.equal(normalizeOpencodeModel("not-a-model", "openai/gpt-5.5"), "openai/gpt-5.5");
});

test("normalizeOpencodeModel accepts Opus and falls back for removed Grok", () => {
  assert.equal(normalizeOpencodeModel("anthropic/claude-opus-4.6", "openai/gpt-5.5"), "anthropic/claude-opus-4.6");
  assert.equal(normalizeOpencodeModel("x-ai/grok-4", "openai/gpt-5.5"), "openai/gpt-5.5");
});

test("toDisplayMessages includes pending assistant stream state", () => {
  const stream = createPendingAssistantStreamState();
  const messages = toDisplayMessages([], {
    threadId: null,
    question: "What changed?",
    createdAt: "2026-04-20T12:00:00.000Z",
    stream: {
      ...stream,
      reasoningText: "Reading files"
    }
  });

  assert.equal(messages.length, 2);
  assert.equal(messages[1]?.pending, true);
  assert.equal(messages[1]?.stream?.reasoningText, "Reading files");
});

test("toDisplayMessages preserves resolved assistant stream state", () => {
  const messages = toDisplayMessages(
    [
      {
        id: "7a2b98ee-9714-4ead-a325-fae569b8b41d",
        role: "assistant",
        status: "complete",
        createdAt: "2026-04-20T12:00:05.000Z",
        response: {
          ok: true,
          backend: "opencode",
          mode: "agent",
          question: "What changed?",
          answer: "The answer.",
          sources: []
        }
      }
    ],
    null,
    {
      "7a2b98ee-9714-4ead-a325-fae569b8b41d": {
        ...createPendingAssistantStreamState(),
        reasoningText: "Inspected notes/day.md"
      }
    }
  );

  assert.equal(messages[0]?.response?.answer, "The answer.");
  assert.equal(messages[0]?.stream?.reasoningText, "Inspected notes/day.md");
});

test("toDisplayMessages prefers persisted assistant stream state over resolved fallback", () => {
  const messages = toDisplayMessages(
    [
      {
        id: "7a2b98ee-9714-4ead-a325-fae569b8b41d",
        role: "assistant",
        status: "complete",
        createdAt: "2026-04-20T12:00:05.000Z",
        response: {
          ok: true,
          backend: "opencode",
          mode: "agent",
          question: "What changed?",
          answer: "The answer.",
          sources: []
        },
        stream: {
          ...createPendingAssistantStreamState(),
          reasoningText: "Persisted trace"
        }
      }
    ],
    null,
    {
      "7a2b98ee-9714-4ead-a325-fae569b8b41d": {
        ...createPendingAssistantStreamState(),
        reasoningText: "Resolved fallback"
      }
    }
  );

  assert.equal(messages[0]?.stream?.reasoningText, "Persisted trace");
});


test("new drafts use OpenRouter while saved subscription choices survive hydration", () => {
  assert.equal(createDraftThreadSettings().openAiRoute, "openrouter");
  withMockWindow(() => {
    assert.equal(loadLocalChatUiState("alice@example.com").draftThreadSettings.openAiRoute, "openrouter");
    saveLocalChatUiState("alice@example.com", {
      selectedThreadId: null,
      draftQuestion: "Saved draft",
      draftThreadSettings: { ...createDraftThreadSettings(), openAiRoute: "subscription" },
      sidebarCollapsed: false
    });
    assert.equal(loadLocalChatUiState("alice@example.com").draftThreadSettings.openAiRoute, "subscription");
  });
});
