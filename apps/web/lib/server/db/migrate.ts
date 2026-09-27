import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { sql } from "drizzle-orm";
import { getChatDatabase } from "@/lib/server/db/client";

let migrationPromise: Promise<void> | null = null;

function resolveMigrationsFolder() {
  // next.config.ts explicitly includes the SQL files in standalone builds.
  // These runtime path probes must not cause Turbopack to trace the whole repo.
  const candidates = [join(process.cwd(), "drizzle"), join(process.cwd(), "apps/web/drizzle")];

  for (const candidate of candidates) {
    if (existsSync(/* turbopackIgnore: true */ candidate)) {
      return candidate;
    }
  }

  throw new Error("Unable to locate chat migrations folder.");
}

export function migrateChatDatabase({ db, sqlite }: ReturnType<typeof getChatDatabase>) {
  const migrationsFolder = resolveMigrationsFolder();

  db.run(sql`
    create table if not exists __lattice_migrations (
      tag text primary key,
      applied_at text not null
    )
  `);

  const appliedRows = db.all<{ tag: string }>(sql`select tag from __lattice_migrations order by tag asc`);
  const migrationTags = new Set(appliedRows.map((row) => row.tag));
  const migrationFiles = readdirSync(/* turbopackIgnore: true */ migrationsFolder)
    .filter((entry) => entry.endsWith(".sql"))
    .sort();

  for (const migrationFile of migrationFiles) {
    const tag = migrationFile.replace(/\.sql$/, "");

    if (migrationTags.has(tag)) {
      continue;
    }

    const migrationSql = readFileSync(/* turbopackIgnore: true */ join(/* turbopackIgnore: true */ migrationsFolder, migrationFile), "utf8");
    const appliedAt = new Date().toISOString();

    sqlite.transaction(() => {
      // Migration files contain multiple statements, so they must run through sqlite.exec().
      sqlite.exec(migrationSql);
      db.run(sql`insert into __lattice_migrations (tag, applied_at) values (${tag}, ${appliedAt})`);
    })();
  }
}

export async function ensureChatDbMigrated() {
  if (!migrationPromise) {
    migrationPromise = Promise.resolve().then(() => migrateChatDatabase(getChatDatabase())).catch((error) => {
      migrationPromise = null;
      throw error;
    });
  }

  return migrationPromise;
}
