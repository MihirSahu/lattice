import type {
  ChatMessage,
  ChatThreadDetail,
  ChatThreadSummary,
  DraftThreadSettings,
  OpencodeOpenAiRoute,
  LocalChatCacheSnapshot,
  LocalChatUiState,
  OpencodeModelId,
  PendingAssistantStreamState,
  PersistedChatMessage
} from "@/lib/schemas";

const LEGACY_CHAT_CACHE_STORAGE_KEY = "lattice-chat-cache-v2";
const LEGACY_CHAT_UI_STORAGE_KEY = "lattice-chat-ui-v2";
export const CHAT_CACHE_STORAGE_KEY_PREFIX = "lattice-chat-cache-v3";
export const CHAT_UI_STORAGE_KEY_PREFIX = "lattice-chat-ui-v3";
export const DEFAULT_THREAD_TITLE = "New chat";
export const FALLBACK_OPENCODE_MODEL: OpencodeModelId = "openai/gpt-5.5";
export const DEFAULT_OPENAI_ROUTE: OpencodeOpenAiRoute = "subscription";
export const LEGACY_DEFAULT_OPENCODE_MODELS = ["openai/gpt-5"] as const;
const SUPPORTED_OPENAI_ROUTES: OpencodeOpenAiRoute[] = ["subscription", "openrouter"];
const SUPPORTED_OPENCODE_MODEL_IDS: OpencodeModelId[] = [
  "anthropic/claude-sonnet-4.6",
  "anthropic/claude-opus-4.6",
  "openai/gpt-5.5",
  "google/gemini-2.5-pro"
];

export type PendingAskOverlay = {
  threadId: string | null;
  question: string;
  createdAt: string;
  stream: PendingAssistantStreamState;
};

export function createPendingAssistantStreamState(): PendingAssistantStreamState {
  return {
    entries: [],
    activeTool: null,
    reasoningText: "",
    files: [],
    error: null
  };
}

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

export function createDraftThreadSettings(model: OpencodeModelId = FALLBACK_OPENCODE_MODEL): DraftThreadSettings {
  return {
    engine: "opencode",
    folder: "",
    model,
    openAiRoute: DEFAULT_OPENAI_ROUTE
  };
}

export function isSupportedOpencodeModel(value: unknown): value is OpencodeModelId {
  return typeof value === "string" && SUPPORTED_OPENCODE_MODEL_IDS.includes(value as OpencodeModelId);
}

export function isLegacyDefaultOpencodeModel(value: unknown): boolean {
  return typeof value === "string" && (LEGACY_DEFAULT_OPENCODE_MODELS as readonly string[]).includes(value);
}

export function isOpenAiOpencodeModel(value: unknown): value is OpencodeModelId {
  return isSupportedOpencodeModel(value) && value.startsWith("openai/");
}

export function isSupportedOpenAiRoute(value: unknown): value is OpencodeOpenAiRoute {
  return typeof value === "string" && SUPPORTED_OPENAI_ROUTES.includes(value as OpencodeOpenAiRoute);
}

export function normalizeOpenAiRoute(value: unknown, model: unknown): OpencodeOpenAiRoute {
  if (!isOpenAiOpencodeModel(model)) {
    return DEFAULT_OPENAI_ROUTE;
  }

  return isSupportedOpenAiRoute(value) ? value : DEFAULT_OPENAI_ROUTE;
}

export function shouldShowOpenAiRouteToggle(engine: unknown, model: unknown) {
  return engine === "opencode" && isOpenAiOpencodeModel(model);
}

export function normalizeOpencodeModel(
  value: unknown,
  fallback: OpencodeModelId,
  options: { upgradeLegacyDefault?: boolean } = {}
): OpencodeModelId {
  const upgradeLegacyDefault = options.upgradeLegacyDefault ?? true;

  if (upgradeLegacyDefault && isLegacyDefaultOpencodeModel(value)) {
    return fallback;
  }

  if (!isSupportedOpencodeModel(value)) {
    return fallback;
  }

  return value;
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
          model: normalizeOpencodeModel(parsed.draftThreadSettings.model, defaultModel),
          openAiRoute: normalizeOpenAiRoute(
            parsed.draftThreadSettings.openAiRoute,
            normalizeOpencodeModel(parsed.draftThreadSettings.model, defaultModel)
          )
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

function createDisplayAssistantMessage(message: PersistedChatMessage, resolvedStreams: ResolvedAssistantStreams): ChatMessage {
  return {
    id: message.id,
    role: "assistant",
    createdAt: message.createdAt,
    response: message.response ?? undefined,
    stream: resolvedStreams[message.id] ?? null,
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
