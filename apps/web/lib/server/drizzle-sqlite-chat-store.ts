import { randomUUID } from "node:crypto";
import { and, asc, desc, eq } from "drizzle-orm";
import type { AppendQuestionAndAnswerInput, ChatStore, UpsertThreadSettingsInput } from "@/lib/server/chat-store";
import { ChatThreadNotFoundError } from "@/lib/server/chat-store";
import { mapPersistedChatMessageRow, mapThreadSummaryRow } from "@/lib/server/chat-store-mappers";
import { getChatDatabase } from "@/lib/server/db/client";
import { ensureChatDbMigrated } from "@/lib/server/db/migrate";
import { chatMessages, chatThreads } from "@/lib/server/db/schema";
import type { ChatThreadDetail, ChatThreadSummary } from "@/lib/schemas";

type DrizzleSqliteChatStoreConfig = {
  dbPath: string;
};

function truncateTitle(question: string) {
  const normalized = question.replace(/\s+/g, " ").trim();

  if (normalized.length <= 52) {
    return normalized;
  }

  return `${normalized.slice(0, 51)}…`;
}

export class DrizzleSqliteChatStore implements ChatStore {
  constructor(private readonly options: DrizzleSqliteChatStoreConfig) {
    if (!options.dbPath) {
      throw new Error("Chat persistence is not configured. Set CHAT_DB_PATH.");
    }
  }

  async listThreadSummaries(userEmail: string): Promise<ChatThreadSummary[]> {
    await ensureChatDbMigrated();

    const { db } = getChatDatabase();
    const rows = await db
      .select()
      .from(chatThreads)
      .where(eq(chatThreads.userEmail, userEmail))
      .orderBy(desc(chatThreads.updatedAt));

    return rows.map(mapThreadSummaryRow);
  }

  async getThreadDetail(userEmail: string, threadId: string): Promise<ChatThreadDetail | null> {
    await ensureChatDbMigrated();

    const { db } = getChatDatabase();
    const threadRow = await db
      .select()
      .from(chatThreads)
      .where(and(eq(chatThreads.id, threadId), eq(chatThreads.userEmail, userEmail)))
      .get();

    if (!threadRow) {
      return null;
    }

    const messageRows = await db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.threadId, threadId))
      .orderBy(asc(chatMessages.createdAt));

    return {
      ...mapThreadSummaryRow(threadRow),
      messages: messageRows.map(mapPersistedChatMessageRow)
    };
  }

  async upsertThreadSettings(input: UpsertThreadSettingsInput): Promise<ChatThreadSummary | null> {
    await ensureChatDbMigrated();

    const { db } = getChatDatabase();
    const existingThread = await db
      .select()
      .from(chatThreads)
      .where(and(eq(chatThreads.id, input.threadId), eq(chatThreads.userEmail, input.userEmail)))
      .get();

    if (!existingThread) {
      return null;
    }

    await db
      .update(chatThreads)
      .set({
        title: input.title ?? existingThread.title,
        engine: input.engine ?? existingThread.engine,
        folder: input.folder ?? existingThread.folder,
        model: input.model !== undefined ? input.model : existingThread.model,
        updatedAt: new Date().toISOString()
      })
      .where(and(eq(chatThreads.id, input.threadId), eq(chatThreads.userEmail, input.userEmail)));

    const updatedThread = await db
      .select()
      .from(chatThreads)
      .where(and(eq(chatThreads.id, input.threadId), eq(chatThreads.userEmail, input.userEmail)))
      .get();

    return updatedThread ? mapThreadSummaryRow(updatedThread) : null;
  }

  async appendQuestionAndAnswer(input: AppendQuestionAndAnswerInput): Promise<ChatThreadDetail> {
    await ensureChatDbMigrated();

    const { db, sqlite } = getChatDatabase();
    const now = new Date().toISOString();
    const nextThreadId = input.threadId ?? randomUUID();

    sqlite.exec("begin");

    try {
      if (input.threadId) {
        const existingThread = db
          .select()
          .from(chatThreads)
          .where(and(eq(chatThreads.id, nextThreadId), eq(chatThreads.userEmail, input.userEmail)))
          .get();

        if (!existingThread) {
          throw new ChatThreadNotFoundError(nextThreadId);
        }

        await db
          .update(chatThreads)
          .set({
            engine: input.engine,
            folder: input.folder ?? "",
            model: input.engine === "opencode" ? input.model ?? null : null,
            updatedAt: now
          })
          .where(and(eq(chatThreads.id, nextThreadId), eq(chatThreads.userEmail, input.userEmail)));
      } else {
        await db.insert(chatThreads).values({
          id: nextThreadId,
          userEmail: input.userEmail,
          title: truncateTitle(input.question),
          engine: input.engine,
          folder: input.folder ?? "",
          model: input.engine === "opencode" ? input.model ?? null : null,
          createdAt: now,
          updatedAt: now
        });
      }

      await db.insert(chatMessages).values({
        id: randomUUID(),
        threadId: nextThreadId,
        role: "user",
        status: "complete",
        createdAt: now,
        question: input.question
      });

      const assistantTimestamp = new Date().toISOString();

      if (input.successResponse) {
        await db.insert(chatMessages).values({
          id: randomUUID(),
          threadId: nextThreadId,
          role: "assistant",
          status: "complete",
          createdAt: assistantTimestamp,
          responseJson: JSON.stringify(input.successResponse)
        });
      }

      if (input.errorResponse) {
        await db.insert(chatMessages).values({
          id: randomUUID(),
          threadId: nextThreadId,
          role: "assistant",
          status: "error",
          createdAt: assistantTimestamp,
          errorText: input.errorResponse.error,
          errorDetailsJson: JSON.stringify(input.errorResponse),
          errorCode: input.errorResponse.code ?? null
        });
      }

      await db
        .update(chatThreads)
        .set({
          updatedAt: assistantTimestamp
        })
        .where(and(eq(chatThreads.id, nextThreadId), eq(chatThreads.userEmail, input.userEmail)));

      sqlite.exec("commit");
    } catch (error) {
      sqlite.exec("rollback");
      throw error;
    }

    const thread = await this.getThreadDetail(input.userEmail, nextThreadId);

    if (!thread) {
      throw new ChatThreadNotFoundError(nextThreadId);
    }

    return thread;
  }
}
