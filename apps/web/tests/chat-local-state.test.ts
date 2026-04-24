import assert from "node:assert/strict";
import test from "node:test";
import {
  createDraftThreadSettings,
  getChatCacheStorageKey,
  getChatUiStorageKey,
  loadLocalChatCache,
  loadLocalChatUiState,
  saveLocalChatCache,
  saveLocalChatUiState
} from "../lib/chat-local-state.ts";

type StorageMap = Map<string, string>;

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
          engine: "qmd",
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
          model: "openai/gpt-5"
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
      draftThreadSettings: createDraftThreadSettings("openai/gpt-5"),
      sidebarCollapsed: true
    });

    const bobUiState = loadLocalChatUiState("bob@example.com", "anthropic/claude-sonnet-4.6");

    assert.equal(bobUiState.selectedThreadId, null);
    assert.equal(bobUiState.draftQuestion, "");
    assert.deepEqual(bobUiState.draftThreadSettings, createDraftThreadSettings("anthropic/claude-sonnet-4.6"));
    assert.equal(bobUiState.sidebarCollapsed, false);
  });
});
