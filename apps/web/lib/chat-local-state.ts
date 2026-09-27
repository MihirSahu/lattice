import { DEFAULT_MODEL_ID, DEFAULT_OPENAI_ROUTE } from "@lattice/model-catalog";
import type {
  ChatMessage,
  ChatThreadSummary,
  DraftThreadSettings,
  LocalChatCacheSnapshot,
  LocalChatUiState,
  PendingAssistantStreamState,
  PersistedChatMessage
} from "@/lib/schemas";

const LEGACY_CHAT_CACHE_STORAGE_KEY = "lattice-chat-cache-v2";
const LEGACY_CHAT_UI_STORAGE_KEY = "lattice-chat-ui-v2";
export const CHAT_CACHE_STORAGE_KEY_PREFIX = "lattice-chat-cache-v3";
export const CHAT_UI_STORAGE_KEY_PREFIX = "lattice-chat-ui-v3";
export const DEFAULT_THREAD_TITLE = "New chat";

export type PendingAskOverlay = {
  threadId: string | null;
  question: string;
  createdAt: string;
  stream: PendingAssistantStreamState;
};

export type ResolvedAssistantStreams = Record<string, PendingAssistantStreamState>;

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

export function createDraftThreadSettings(): DraftThreadSettings {
  return { engine: "opencode", folder: "" };
}

function getDefaultUiState(): LocalChatUiState {
  return {
    selectedThreadId: null,
    draftQuestion: "",
    draftThreadSettings: createDraftThreadSettings(),
    sidebarCollapsed: false
  };
}

// Historical answers remain intact; every conversation continues with the fixed model.
function normalizeCachedThread<T extends ChatThreadSummary>(thread: T): T {
  return { ...thread, engine: "opencode", model: DEFAULT_MODEL_ID, openAiRoute: DEFAULT_OPENAI_ROUTE };
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
      threadSummaries: parsed.threadSummaries.map((thread) => normalizeCachedThread(thread)),
      lastThreadDetail: parsed.lastThreadDetail ? normalizeCachedThread(parsed.lastThreadDetail) : null,
      cachedAt: typeof parsed.cachedAt === "string" ? parsed.cachedAt : null
    };
  } catch {
    return null;
  }
}

export function saveLocalChatCache(userEmail: string, snapshot: LocalChatCacheSnapshot) {
  setStorageItem(getChatCacheStorageKey(userEmail), JSON.stringify(snapshot));
}

export function loadLocalChatUiState(userEmail: string): LocalChatUiState {
  const rawValue = getStorageItem(getChatUiStorageKey(userEmail));

  if (!rawValue) {
    return getDefaultUiState();
  }

  try {
    const parsed = JSON.parse(rawValue) as Partial<LocalChatUiState>;
    const draftThreadSettings = isObject(parsed.draftThreadSettings)
      ? {
          engine: "opencode" as const,
          folder: typeof parsed.draftThreadSettings.folder === "string" ? parsed.draftThreadSettings.folder : ""
        }
      : createDraftThreadSettings();

    return {
      selectedThreadId: typeof parsed.selectedThreadId === "string" ? parsed.selectedThreadId : null,
      draftQuestion: typeof parsed.draftQuestion === "string" ? parsed.draftQuestion : "",
      draftThreadSettings,
      sidebarCollapsed: Boolean(parsed.sidebarCollapsed)
    };
  } catch {
    return getDefaultUiState();
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

function createDisplayAssistantMessage(message: PersistedChatMessage, resolvedStreams: ResolvedAssistantStreams): ChatMessage {
  return {
    id: message.id,
    role: "assistant",
    createdAt: message.createdAt,
    response: message.response ?? undefined,
    stream: message.stream ?? resolvedStreams[message.id] ?? null,
    error: message.errorText ?? null,
    errorDetails: message.errorDetails ?? null,
    errorCode: message.errorCode ?? null
  };
}

export function toDisplayMessages(
  messages: PersistedChatMessage[],
  pendingAsk: PendingAskOverlay | null,
  resolvedStreams: ResolvedAssistantStreams = {}
): ChatMessage[] {
  const displayMessages = messages.map((message) => {
    if (message.role === "user") {
      return createDisplayUserMessage(message.id, message.question ?? "", message.createdAt);
    }

    return createDisplayAssistantMessage(message, resolvedStreams);
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
      stream: pendingAsk.stream,
      error: null
    }
  ];
}
