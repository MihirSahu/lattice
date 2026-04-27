import {
  OPENCODE_MODEL_IDS,
  chatThreadDetailSchema,
  chatThreadSummarySchema,
  pendingAssistantStreamStateSchema,
  persistedChatMessageSchema,
  type AskErrorResponse,
  type AskResponse,
  type ChatThreadDetail,
  type ChatThreadSummary,
  type PersistedChatMessage
} from "../schemas.ts";

const LEGACY_MODEL_UPGRADES: Record<string, string> = {
  "openai/gpt-5": "openai/gpt-5.5"
};

const supportedModelIds = new Set<string>(OPENCODE_MODEL_IDS);

export type ChatThreadRow = {
  id: string;
  title: string;
  engine: string;
  folder: string;
  model: string | null;
  openAiRoute?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ChatMessageRow = {
  id: string;
  role: string;
  status: string;
  createdAt: string;
  question: string | null;
  responseJson: string | null;
  errorText: string | null;
  errorDetailsJson: string | null;
  errorCode: string | null;
};

export type ChatMessageTraceRow = {
  messageId: string;
  streamJson: string | null;
  createdAt: string;
  updatedAt: string;
};

function parseJsonValue<T>(value: string | null): T | null {
  if (!value) {
    return null;
  }

  return JSON.parse(value) as T;
}

function parseAssistantStream(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value);
    const result = pendingAssistantStreamStateSchema.safeParse(parsed);

    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

function normalizePersistedModel(value: string | null) {
  if (!value) {
    return null;
  }

  const upgradedValue = LEGACY_MODEL_UPGRADES[value] ?? value;

  return supportedModelIds.has(upgradedValue) ? upgradedValue : null;
}

export function mapThreadSummaryRow(row: ChatThreadRow): ChatThreadSummary {
  const model = normalizePersistedModel(row.model);

  return chatThreadSummarySchema.parse({
    ...row,
    model,
    openAiRoute: model?.startsWith("openai/") ? row.openAiRoute ?? "subscription" : null
  });
}

export function mapPersistedChatMessageRow(row: ChatMessageRow, traceRow?: ChatMessageTraceRow): PersistedChatMessage {
  const response = parseJsonValue<AskResponse>(row.responseJson);
  const errorPayload = parseJsonValue<AskErrorResponse>(row.errorDetailsJson);

  return persistedChatMessageSchema.parse({
    id: row.id,
    role: row.role,
    status: row.status,
    createdAt: row.createdAt,
    question: row.question,
    response,
    stream: parseAssistantStream(traceRow?.streamJson),
    errorText: row.errorText,
    errorDetails: errorPayload?.details ?? null,
    errorCode: row.errorCode
  });
}

export function mapThreadDetail(
  threadRow: ChatThreadRow,
  messageRows: ChatMessageRow[],
  traceRows: ChatMessageTraceRow[] = []
): ChatThreadDetail {
  const traceByMessageId = new Map(traceRows.map((row) => [row.messageId, row]));

  return chatThreadDetailSchema.parse({
    ...mapThreadSummaryRow(threadRow),
    messages: messageRows.map((row) => mapPersistedChatMessageRow(row, traceByMessageId.get(row.id)))
  });
}
