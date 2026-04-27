import { index, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const chatThreads = sqliteTable(
  "chat_threads",
  {
    id: text("id").primaryKey(),
    userEmail: text("user_email").notNull(),
    title: text("title").notNull(),
    engine: text("engine").notNull(),
    folder: text("folder").notNull().default(""),
    model: text("model"),
    openAiRoute: text("openai_route"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull()
  },
  (table: any) => ({
    userEmailUpdatedAtIdx: index("chat_threads_user_email_updated_at_idx").on(table.userEmail, table.updatedAt)
  })
);

export const chatMessages = sqliteTable(
  "chat_messages",
  {
    id: text("id").primaryKey(),
    threadId: text("thread_id")
      .notNull()
      .references(() => chatThreads.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    status: text("status").notNull(),
    createdAt: text("created_at").notNull(),
    question: text("question"),
    responseJson: text("response_json"),
    errorText: text("error_text"),
    errorDetailsJson: text("error_details_json"),
    errorCode: text("error_code")
  },
  (table: any) => ({
    threadCreatedAtIdx: index("chat_messages_thread_id_created_at_idx").on(table.threadId, table.createdAt)
  })
);

export const schema = {
  chatThreads,
  chatMessages
};
