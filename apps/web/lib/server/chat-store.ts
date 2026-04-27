import { config } from "@/lib/config";
import { DrizzleSqliteChatStore } from "@/lib/server/drizzle-sqlite-chat-store";
import type { AskErrorResponse, AskResponse, ChatAskRequest, ChatThreadDetail, ChatThreadSummary } from "@/lib/schemas";

export type UpsertThreadSettingsInput = {
  threadId: string;
  userEmail: string;
  title?: string;
  engine?: ChatAskRequest["engine"];
  folder?: string;
  model?: ChatAskRequest["model"] | null;
  openAiRoute?: ChatAskRequest["openAiRoute"] | null;
};

export type AppendQuestionAndAnswerInput = {
  threadId?: string;
  userEmail: string;
  question: string;
  engine: ChatAskRequest["engine"];
  folder?: string;
  model?: ChatAskRequest["model"];
  openAiRoute?: ChatAskRequest["openAiRoute"];
  successResponse?: AskResponse;
  errorResponse?: AskErrorResponse;
};

export interface ChatStore {
  listThreadSummaries(userEmail: string): Promise<ChatThreadSummary[]>;
  getThreadDetail(userEmail: string, threadId: string): Promise<ChatThreadDetail | null>;
  upsertThreadSettings(input: UpsertThreadSettingsInput): Promise<ChatThreadSummary | null>;
  appendQuestionAndAnswer(input: AppendQuestionAndAnswerInput): Promise<ChatThreadDetail>;
}

export class ChatThreadNotFoundError extends Error {
  constructor(threadId: string) {
    super(`Chat thread ${threadId} was not found.`);
    this.name = "ChatThreadNotFoundError";
  }
}

let store: ChatStore | null = null;

export function getChatStore(): ChatStore {
  if (!store) {
    store = new DrizzleSqliteChatStore({
      dbPath: config.chatDbPath
    });
  }

  return store;
}
