import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { config } from "@/lib/config";
import { schema } from "@/lib/server/db/schema";

type ChatDatabase = {
  sqlite: Database.Database;
  db: BetterSQLite3Database<typeof schema>;
};

const globalForChatDb = globalThis as typeof globalThis & {
  __latticeChatDb?: ChatDatabase;
};

function createChatDatabase(dbPath: string): ChatDatabase {
  mkdirSync(dirname(dbPath), { recursive: true });

  const sqlite = new Database(dbPath);

  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("synchronous = NORMAL");
  sqlite.pragma("foreign_keys = ON");
  sqlite.pragma("busy_timeout = 5000");

  return {
    sqlite,
    db: drizzle(sqlite, { schema })
  };
}

export function getChatDatabase() {
  if (!globalForChatDb.__latticeChatDb) {
    globalForChatDb.__latticeChatDb = createChatDatabase(config.chatDbPath);
  }

  return globalForChatDb.__latticeChatDb;
}
