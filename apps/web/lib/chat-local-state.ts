import type {
  ChatMessage,
  ChatThreadDetail,
  ChatThreadSummary,
  DraftThreadSettings,
  LocalChatCacheSnapshot,
  LocalChatUiState,
  OpencodeModelId,
  PersistedChatMessage
} from "@/lib/schemas";

const LEGACY_CHAT_CACHE_STORAGE_KEY = "lattice-chat-cache-v2";
const LEGACY_CHAT_UI_STORAGE_KEY = "lattice-chat-ui-v2";
export const CHAT_CACHE_STORAGE_KEY_PREFIX = "lattice-chat-cache-v3";
export const CHAT_UI_STORAGE_KEY_PREFIX = "lattice-chat-ui-v3";
export const DEFAULT_THREAD_TITLE = "New chat";
export const FALLBACK_OPENCODE_MODEL: OpencodeModelId = "anthropic/claude-sonnet-4.6";

export type PendingAskOverlay = {
  threadId: string | null;
  question: string;
  createdAt: string;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function normalizeUserStorageKey(userEmail: string) {
  return userEmail.trim().toLowerCase();
}

function clearLegacyChatStorage() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(LEGACY_CHAT_CACHE_STORAGE_KEY);
  window.localStorage.removeItem(LEGACY_CHAT_UI_STORAGE_KEY);
}

function getStorageItem(key: string) {
  if (typeof window === "undefined") {
    return null;
  }

  clearLegacyChatStorage();

  return window.localStorage.getItem(key);
}

function setStorageItem(key: string, value: string) {
  if (typeof window === "undefined") {
    return;
  }

  clearLegacyChatStorage();
  window.localStorage.setItem(key, value);
}

export function getChatCacheStorageKey(userEmail: string) {
  return `${CHAT_CACHE_STORAGE_KEY_PREFIX}:${normalizeUserStorageKey(userEmail)}`;
}

export function getChatUiStorageKey(userEmail: string) {
  return `${CHAT_UI_STORAGE_KEY_PREFIX}:${normalizeUserStorageKey(userEmail)}`;
}

export function createDraftThreadSettings(model: OpencodeModelId = FALLBACK_OPENCODE_MODEL): DraftThreadSettings {
  return {
    engine: "opencode",
    folder: "",
    model
  };
}

function getDefaultUiState(defaultModel: OpencodeModelId): LocalChatUiState {
  return {
    selectedThreadId: null,
    draftQuestion: "",
    draftThreadSettings: createDraftThreadSettings(defaultModel),
    sidebarCollapsed: false
  };
}

export function loadLocalChatCache(userEmail: string): LocalChatCacheSnapshot | null {
  const rawValue = getStorageItem(getChatCacheStorageKey(userEmail));

  if (!rawValue) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawValue) as LocalChatCacheSnapshot;

    if (!isObject(parsed) || !Array.isArray(parsed.threadSummaries)) {
      return null;
    }

    return {
      threadSummaries: parsed.threadSummaries as ChatThreadSummary[],
      lastThreadDetail: (parsed.lastThreadDetail as ChatThreadDetail | null) ?? null,
      cachedAt: typeof parsed.cachedAt === "string" ? parsed.cachedAt : null
    };
  } catch {
    return null;
  }
}

export function saveLocalChatCache(userEmail: string, snapshot: LocalChatCacheSnapshot) {
  setStorageItem(getChatCacheStorageKey(userEmail), JSON.stringify(snapshot));
}

export function loadLocalChatUiState(
  userEmail: string,
  defaultModel: OpencodeModelId = FALLBACK_OPENCODE_MODEL
): LocalChatUiState {
  const rawValue = getStorageItem(getChatUiStorageKey(userEmail));

  if (!rawValue) {
    return getDefaultUiState(defaultModel);
  }

  try {
    const parsed = JSON.parse(rawValue) as Partial<LocalChatUiState>;
    const draftThreadSettings = isObject(parsed.draftThreadSettings)
      ? {
          engine: (parsed.draftThreadSettings.engine === "qmd" ? "qmd" : "opencode") as DraftThreadSettings["engine"],
          folder: typeof parsed.draftThreadSettings.folder === "string" ? parsed.draftThreadSettings.folder : "",
          model: typeof parsed.draftThreadSettings.model === "string" ? parsed.draftThreadSettings.model : defaultModel
        }
      : createDraftThreadSettings(defaultModel);

    return {
      selectedThreadId: typeof parsed.selectedThreadId === "string" ? parsed.selectedThreadId : null,
      draftQuestion: typeof parsed.draftQuestion === "string" ? parsed.draftQuestion : "",
      draftThreadSettings,
      sidebarCollapsed: Boolean(parsed.sidebarCollapsed)
    };
  } catch {
    return getDefaultUiState(defaultModel);
  }
}

export function saveLocalChatUiState(userEmail: string, state: LocalChatUiState) {
  setStorageItem(getChatUiStorageKey(userEmail), JSON.stringify(state));
}

function createDisplayUserMessage(id: string, question: string, createdAt: string): ChatMessage {
  return {
    id,
    role: "user",
    createdAt,
    question
  };
}

function createDisplayAssistantMessage(message: PersistedChatMessage): ChatMessage {
  return {
    id: message.id,
    role: "assistant",
    createdAt: message.createdAt,
    response: message.response ?? undefined,
    error: message.errorText ?? null,
    errorDetails: message.errorDetails ?? null,
    errorCode: message.errorCode ?? null
  };
}

export function toDisplayMessages(messages: PersistedChatMessage[], pendingAsk: PendingAskOverlay | null): ChatMessage[] {
  const displayMessages = messages.map((message) => {
    if (message.role === "user") {
      return createDisplayUserMessage(message.id, message.question ?? "", message.createdAt);
    }

    return createDisplayAssistantMessage(message);
  });

  if (!pendingAsk) {
    return displayMessages;
  }

  return [
    ...displayMessages,
    createDisplayUserMessage(`pending-user-${pendingAsk.createdAt}`, pendingAsk.question, pendingAsk.createdAt),
    {
      id: `pending-assistant-${pendingAsk.createdAt}`,
      role: "assistant",
      createdAt: pendingAsk.createdAt,
      pending: true,
      error: null
    }
  ];
}
