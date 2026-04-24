import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { sql } from "drizzle-orm";
import { getChatDatabase } from "@/lib/server/db/client";

let migrationPromise: Promise<void> | null = null;

function resolveMigrationsFolder() {
  const candidates = [join(process.cwd(), "drizzle"), join(process.cwd(), "apps/web/drizzle")];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  throw new Error("Unable to locate chat migrations folder.");
}

export async function ensureChatDbMigrated() {
  if (migrationPromise) {
    return migrationPromise;
  }

  migrationPromise = (async () => {
    const { db, sqlite } = getChatDatabase();
    const migrationsFolder = resolveMigrationsFolder();

    await db.run(sql`
      create table if not exists __lattice_migrations (
        tag text primary key,
        applied_at text not null
      )
    `);

    const appliedRows = db.all(sql`select tag from __lattice_migrations order by tag asc`) as Array<{ tag: string }>;
    const migrationTags = new Set(appliedRows.map((row) => row.tag));
    const migrationFiles = readdirSync(migrationsFolder)
      .filter((entry) => entry.endsWith(".sql"))
      .sort();

    for (const migrationFile of migrationFiles) {
      const tag = migrationFile.replace(/\.sql$/, "");

      if (migrationTags.has(tag)) {
        continue;
      }

      const migrationSql = readFileSync(join(migrationsFolder, migrationFile), "utf8");
      const appliedAt = new Date().toISOString();

      sqlite.exec("begin");

      try {
        // Migration files contain multiple statements, so they must run through sqlite.exec().
        sqlite.exec(migrationSql);
        await db.run(sql`insert into __lattice_migrations (tag, applied_at) values (${tag}, ${appliedAt})`);
        sqlite.exec("commit");
      } catch (error) {
        sqlite.exec("rollback");
        throw error;
      }
    }
  })().catch((error) => {
    migrationPromise = null;
    throw error;
  });

  return migrationPromise;
}
