import {
  chatThreadDetailSchema,
  chatThreadSummarySchema,
  persistedChatMessageSchema,
  type AskErrorResponse,
  type AskResponse,
  type ChatThreadDetail,
  type ChatThreadSummary,
  type PersistedChatMessage
} from "../schemas.ts";

export type ChatThreadRow = {
  id: string;
  title: string;
  engine: string;
  folder: string;
  model: string | null;
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

function parseJsonValue<T>(value: string | null): T | null {
  if (!value) {
    return null;
  }

  return JSON.parse(value) as T;
}

export function mapThreadSummaryRow(row: ChatThreadRow): ChatThreadSummary {
  return chatThreadSummarySchema.parse(row);
}

export function mapPersistedChatMessageRow(row: ChatMessageRow): PersistedChatMessage {
  const response = parseJsonValue<AskResponse>(row.responseJson);
  const errorPayload = parseJsonValue<AskErrorResponse>(row.errorDetailsJson);

  return persistedChatMessageSchema.parse({
    id: row.id,
    role: row.role,
    status: row.status,
    createdAt: row.createdAt,
    question: row.question,
    response,
    errorText: row.errorText,
    errorDetails: errorPayload?.details ?? null,
    errorCode: row.errorCode
  });
}

export function mapThreadDetail(threadRow: ChatThreadRow, messageRows: ChatMessageRow[]): ChatThreadDetail {
  return chatThreadDetailSchema.parse({
    ...mapThreadSummaryRow(threadRow),
    messages: messageRows.map(mapPersistedChatMessageRow)
  });
}
