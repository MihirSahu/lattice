import { z } from "zod";

export const queryEngineSchema = z.enum(["qmd", "opencode"]);
export const chatRoleSchema = z.enum(["user", "assistant"]);
export const persistedChatMessageStatusSchema = z.enum(["complete", "error"]);
export const OPENCODE_MODEL_IDS = [
  "anthropic/claude-sonnet-4.6",
  "anthropic/claude-opus-4.6",
  "openai/gpt-5.5",
  "google/gemini-2.5-pro"
] as const;
export const opencodeModelIdSchema = z.enum(OPENCODE_MODEL_IDS);
export const opencodeOpenAiRouteSchema = z.enum(["subscription", "openrouter"]);
export const opencodeModelProviderSchema = z.enum(["anthropic", "openai", "google"]);
export const opencodeModelIconKeySchema = z.enum(["claude", "openai", "gemini"]);
export const opencodeModelOptionSchema = z.object({
  id: opencodeModelIdSchema,
  label: z.string(),
  provider: opencodeModelProviderSchema,
  iconKey: opencodeModelIconKeySchema,
  description: z.string(),
  isDefault: z.boolean()
});

export const sourceSchema = z.object({
  id: z.string(),
  title: z.string(),
  path: z.string().nullable(),
  snippet: z.string(),
  score: z.number().nullable(),
  context: z.string().nullable()
});

export const sourceFolderSchema = z.object({
  id: z.string(),
  title: z.string(),
  path: z.string(),
  depth: z.number().int().positive()
});

export const askRequestSchema = z.object({
  question: z.string().trim().min(1),
  folder: z.string().trim().min(1).optional(),
  engine: queryEngineSchema.optional(),
  model: opencodeModelIdSchema.optional(),
  openAiRoute: opencodeOpenAiRouteSchema.optional(),
  limit: z.number().int().positive().max(20).optional()
});

export const askResponseSchema = z.object({
  ok: z.literal(true),
  backend: queryEngineSchema,
  mode: z.string(),
  provider: z.string().optional(),
  model: z.string().optional(),
  openAiRoute: opencodeOpenAiRouteSchema.optional(),
  question: z.string(),
  folder: z.string().nullable().optional(),
  duration_ms: z.number().nonnegative().optional(),
  answer: z.string(),
  sources: z.array(sourceSchema)
});

export const askErrorResponseSchema = z.object({
  ok: z.literal(false).optional(),
  error: z.string(),
  details: z.array(z.string()).optional(),
  code: z.string().optional(),
  provider: z.string().optional()
});

export const statusSchema = z.object({
  app: z.string(),
  currentRun: z.object({
    running: z.boolean(),
    runId: z.string().nullable(),
    trigger: z.string().nullable(),
    startedAt: z.string().nullable(),
    finishedAt: z.string().nullable()
  }),
  sync: z.object({
    lastAttemptAt: z.string().nullable(),
    lastSuccessAt: z.string().nullable(),
    lastFailureAt: z.string().nullable(),
    lastResult: z.string(),
    summary: z.string(),
    changedFiles: z.number(),
    fileCount: z.number(),
    deleteEnabled: z.boolean(),
    logPath: z.string().nullable(),
    error: z.string().nullable()
  }),
  index: z.object({
    lastUpdateAt: z.string().nullable(),
    lastEmbedAt: z.string().nullable(),
    embeddingsPending: z.number(),
    lastEmbedStrategy: z.string(),
    lastUpdateSummary: z.record(z.string(), z.string()).nullable(),
    lastEmbedSummary: z.record(z.string(), z.string()).nullable()
  }),
  services: z.object({
    syncWorkerHealthy: z.boolean(),
    qmdHealthy: z.boolean(),
    opencodeHealthy: z.boolean()
  })
});

export const sourceFoldersResponseSchema = z.object({
  ok: z.literal(true),
  collection: z.string(),
  folders: z.array(sourceFolderSchema)
});

export const opencodeModelsResponseSchema = z.object({
  ok: z.literal(true),
  models: z.array(opencodeModelOptionSchema).min(1)
});

export const traceFileOperationSchema = z.enum(["read", "search", "list", "write", "command", "unknown"]);

export const traceFileReferenceSchema = z.object({
  path: z.string(),
  operation: traceFileOperationSchema,
  lineStart: z.number().int().optional(),
  lineEnd: z.number().int().optional(),
  source: z.string().optional()
});

export const traceTokenUsageSchema = z.object({
  input: z.number(),
  output: z.number(),
  reasoning: z.number(),
  cacheRead: z.number(),
  cacheWrite: z.number()
});

export const reasoningTraceEntrySchema = z.object({
  id: z.string(),
  type: z.enum(["status", "session", "thinking", "tool_start", "tool_progress", "tool_finish", "tool_error", "file_access"]),
  label: z.string(),
  createdAt: z.string().datetime(),
  toolName: z.string().optional(),
  toolUseId: z.string().optional(),
  status: z.string().optional(),
  inputSummary: z.string().optional(),
  outputSummary: z.string().optional(),
  elapsedMs: z.number().optional(),
  files: z.array(traceFileReferenceSchema).optional(),
  tokens: traceTokenUsageSchema.optional(),
  cost: z.number().optional(),
  error: z.string().optional()
});

export const activeToolStateSchema = z.object({
  toolName: z.string(),
  toolUseId: z.string(),
  label: z.string(),
  startedAt: z.string().datetime(),
  inputSummary: z.string().optional(),
  files: z.array(traceFileReferenceSchema).optional()
});

export const pendingAssistantStreamStateSchema = z.object({
  entries: z.array(reasoningTraceEntrySchema),
  activeTool: activeToolStateSchema.nullable(),
  reasoningText: z.string(),
  files: z.array(traceFileReferenceSchema),
  error: z.string().nullable()
});

export const persistedChatMessageSchema = z.object({
  id: z.string().uuid(),
  role: chatRoleSchema,
  status: persistedChatMessageStatusSchema,
  createdAt: z.string().datetime(),
  question: z.string().nullable().optional(),
  response: askResponseSchema.nullable().optional(),
  stream: pendingAssistantStreamStateSchema.nullable().optional(),
  errorText: z.string().nullable().optional(),
  errorDetails: z.array(z.string()).nullable().optional(),
  errorCode: z.string().nullable().optional()
});

export const chatThreadSummarySchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  engine: queryEngineSchema,
  folder: z.string(),
  model: opencodeModelIdSchema.nullable().optional(),
  openAiRoute: opencodeOpenAiRouteSchema.nullable().optional()
});

export const chatThreadDetailSchema = chatThreadSummarySchema.extend({
  messages: z.array(persistedChatMessageSchema)
});

export const chatThreadSummaryResponseSchema = z.object({
  ok: z.literal(true),
  thread: chatThreadSummarySchema
});

export const chatThreadsResponseSchema = z.object({
  ok: z.literal(true),
  userEmail: z.string().trim().min(1),
  threads: z.array(chatThreadSummarySchema)
});

export const chatThreadDetailResponseSchema = z.object({
  ok: z.literal(true),
  thread: chatThreadDetailSchema
});

export const chatThreadPatchRequestSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    engine: queryEngineSchema.optional(),
    folder: z.string().optional(),
    model: opencodeModelIdSchema.nullable().optional(),
    openAiRoute: opencodeOpenAiRouteSchema.nullable().optional()
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one thread setting must be provided."
  });

export const chatAskRequestSchema = z.object({
  threadId: z.string().uuid().optional(),
  question: z.string().trim().min(1),
  engine: queryEngineSchema,
  folder: z.string().optional(),
  model: opencodeModelIdSchema.optional(),
  openAiRoute: opencodeOpenAiRouteSchema.optional()
});

export const chatAskResponseSchema = z.object({
  ok: z.boolean(),
  thread: chatThreadDetailSchema,
  error: askErrorResponseSchema.optional()
});

export type ChatRole = "user" | "assistant";
export type AskResponse = z.infer<typeof askResponseSchema>;
export type AskErrorResponse = z.infer<typeof askErrorResponseSchema>;
export type StatusPayload = z.infer<typeof statusSchema>;
export type SourceFolder = z.infer<typeof sourceFolderSchema>;
export type OpencodeModelId = z.infer<typeof opencodeModelIdSchema>;
export type OpencodeOpenAiRoute = z.infer<typeof opencodeOpenAiRouteSchema>;
export type OpencodeModelOption = z.infer<typeof opencodeModelOptionSchema>;
export type PersistedChatMessage = z.infer<typeof persistedChatMessageSchema>;
export type ChatThreadSummary = z.infer<typeof chatThreadSummarySchema>;
export type ChatThreadDetail = z.infer<typeof chatThreadDetailSchema>;
export type ChatAskRequest = z.infer<typeof chatAskRequestSchema>;
export type ChatAskResponse = z.infer<typeof chatAskResponseSchema>;
export type ChatThreadsResponse = z.infer<typeof chatThreadsResponseSchema>;
export type ReasoningTraceEntry = z.infer<typeof reasoningTraceEntrySchema>;
export type ActiveToolState = z.infer<typeof activeToolStateSchema>;
export type PendingAssistantStreamState = z.infer<typeof pendingAssistantStreamStateSchema>;
export type TraceFileOperation = z.infer<typeof traceFileOperationSchema>;
export type TraceFileReference = z.infer<typeof traceFileReferenceSchema>;
export type TraceTokenUsage = z.infer<typeof traceTokenUsageSchema>;

export type ChatMessage = {
  id: string;
  role: ChatRole;
  createdAt: string;
  question?: string;
  response?: AskResponse;
  pending?: boolean;
  stream?: PendingAssistantStreamState | null;
  error?: string | null;
  errorDetails?: string[] | null;
  errorCode?: string | null;
};

export type DraftThreadSettings = {
  engine: z.infer<typeof queryEngineSchema>;
  folder: string;
  model: OpencodeModelId;
  openAiRoute: OpencodeOpenAiRoute;
};

export type LocalChatCacheSnapshot = {
  threadSummaries: ChatThreadSummary[];
  lastThreadDetail: ChatThreadDetail | null;
  cachedAt: string | null;
};

export type LocalChatUiState = {
  selectedThreadId: string | null;
  draftQuestion: string;
  draftThreadSettings: DraftThreadSettings;
  sidebarCollapsed: boolean;
};
