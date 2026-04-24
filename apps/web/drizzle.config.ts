import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "sqlite",
  schema: "./lib/server/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: process.env.CHAT_DB_PATH || "/var/lib/lattice/chat/chat.sqlite"
  }
});
