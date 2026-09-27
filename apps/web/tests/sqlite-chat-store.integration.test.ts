import assert from "node:assert/strict";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import type { PendingAssistantStreamState } from "../lib/schemas.ts";

test("SQLite chat store migrates, persists, and isolates users", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "lattice-chat-test-"));
  const previousDbPath = process.env.CHAT_DB_PATH;
  process.env.CHAT_DB_PATH = join(directory, "chat.sqlite");

  // Import only after configuring a fresh database; never open the developer's database.
  const { getChatDatabase } = await import("../lib/server/db/client.ts");
  const { getChatStore, ChatThreadNotFoundError } = await import("../lib/server/chat-store.ts");
  const { ensureChatDbMigrated } = await import("../lib/server/db/migrate.ts");
  const database = getChatDatabase();
  t.after(async () => {
    database.sqlite.close();
    if (previousDbPath === undefined) delete process.env.CHAT_DB_PATH;
    else process.env.CHAT_DB_PATH = previousDbPath;
    await rm(directory, { recursive: true, force: true });
  });
  assert.equal(database.sqlite.name, process.env.CHAT_DB_PATH);

  const store = getChatStore();
  const alice = "alice@example.test";
  const bob = "bob@example.test";
  const stream: PendingAssistantStreamState = {
    entries: [],
    activeTool: null,
    reasoningText: "Read the private source.",
    files: [{ path: "notes/private.md", operation: "read" }],
    error: null
  };

  await t.test("applies every checked-in migration exactly once", async () => {
    await Promise.all([ensureChatDbMigrated(), ensureChatDbMigrated()]);
    await ensureChatDbMigrated();
    const expected = (await readdir(new URL("../drizzle/", import.meta.url)))
      .filter((name) => name.endsWith(".sql"))
      .map((name) => name.replace(/\.sql$/, ""))
      .sort();
    const rows = database.sqlite.prepare("select tag from __lattice_migrations order by tag").all() as { tag: string }[];
    assert.deepEqual(rows.map((row) => row.tag), expected);
    assert.equal(database.sqlite.pragma("foreign_keys", { simple: true }), 1);
  });

  await t.test("upgrades an existing QMD database without changing history or other users' settings", async () => {
    const { createChatDatabase } = await import("../lib/server/db/client.ts");
    const { migrateChatDatabase } = await import("../lib/server/db/migrate.ts");
    const legacy = createChatDatabase(join(directory, "legacy.sqlite"));
    try {
      legacy.sqlite.exec("create table __lattice_migrations (tag text primary key, applied_at text not null)");
      for (const tag of ["0000_chat_persistence", "0001_openai_route", "0002_chat_message_traces"]) {
        legacy.sqlite.exec(await readFile(new URL(`../drizzle/${tag}.sql`, import.meta.url), "utf8"));
        legacy.sqlite.prepare("insert into __lattice_migrations values (?, ?)").run(tag, "2026-01-01T00:00:00.000Z");
      }
      const insertThread = legacy.sqlite.prepare(`insert into chat_threads
        (id, user_email, title, engine, folder, model, openai_route, created_at, updated_at)
        values (?, ?, 'History', ?, 'notes', ?, ?, '2026-01-01T00:00:00.000Z', '2026-01-02T00:00:00.000Z')`);
      insertThread.run("legacy", alice, "qmd", null, null);
      insertThread.run("existing", bob, "opencode", "openai/gpt-5.5", "subscription");
      const historicalResponse = JSON.stringify({ ok: true, backend: "qmd", mode: "answer", question: "Old question", answer: "Original answer", sources: [] });
      legacy.sqlite.prepare(`insert into chat_messages
        (id, thread_id, role, status, created_at, response_json)
        values ('old-answer', 'legacy', 'assistant', 'complete', '2026-01-01T00:00:00.000Z', ?)`)
        .run(historicalResponse);
      legacy.sqlite.prepare(`insert into chat_message_traces (message_id, stream_json, created_at, updated_at)
        values ('old-answer', ?, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z')`).run(JSON.stringify(stream));
      const messagesBefore = legacy.sqlite.prepare("select * from chat_messages").all();
      const tracesBefore = legacy.sqlite.prepare("select * from chat_message_traces").all();
      const bobBefore = legacy.sqlite.prepare("select * from chat_threads where user_email = ?").get(bob);

      migrateChatDatabase(legacy);
      migrateChatDatabase(legacy);

      const upgraded = legacy.sqlite.prepare("select engine, model, openai_route, updated_at from chat_threads where user_email = ?").get(alice);
      assert.deepEqual(upgraded, { engine: "opencode", model: "openai/gpt-5.5", openai_route: "openrouter", updated_at: "2026-01-02T00:00:00.000Z" });
      assert.deepEqual(legacy.sqlite.prepare("select * from chat_threads where user_email = ?").get(bob), bobBefore);
      assert.deepEqual(legacy.sqlite.prepare("select * from chat_messages").all(), messagesBefore);
      assert.deepEqual(legacy.sqlite.prepare("select * from chat_message_traces").all(), tracesBefore);
    } finally {
      legacy.sqlite.close();
    }
  });

  const thread = await store.appendQuestionAndAnswer({
    userEmail: alice,
    question: "What changed?",
    engine: "opencode",
    model: "openai/gpt-5.5",
    openAiRoute: "openrouter",
    successResponse: {
      ok: true, backend: "opencode", mode: "agent", question: "What changed?",
      answer: "The index was refreshed.", sources: []
    },
    assistantStream: stream
  });

  await t.test("restores responses, settings, and assistant traces from SQLite", async () => {
    const loaded = await store.getThreadDetail(alice, thread.id);
    assert.deepEqual(loaded, thread);
    assert.equal(loaded?.messages.find((message) => message.role === "assistant")?.response?.answer, "The index was refreshed.");
    assert.deepEqual(loaded?.messages.find((message) => message.role === "assistant")?.stream, stream);
    assert.equal(loaded?.openAiRoute, "openrouter");
    const updated = await store.upsertThreadSettings({ userEmail: alice, threadId: thread.id, title: "Updated title" });
    assert.equal(updated?.title, "Updated title");
    assert.equal((await store.listThreadSummaries(alice))[0]?.id, thread.id);

    // A second connection verifies the committed on-disk data independently of the store.
    const { default: Database } = await import("better-sqlite3");
    const reader = new Database(database.sqlite.name, { readonly: true });
    try {
      const row = reader.prepare("select stream_json from chat_message_traces").get() as { stream_json: string };
      assert.deepEqual(JSON.parse(row.stream_json), stream);
    } finally {
      reader.close();
    }
  });

  await t.test("prevents another user from reading or modifying the thread and its traces", async () => {
    assert.deepEqual(await store.listThreadSummaries(bob), []);
    assert.equal(await store.getThreadDetail(bob, thread.id), null);
    assert.equal(await store.upsertThreadSettings({ userEmail: bob, threadId: thread.id, title: "Intrusion" }), null);
    await assert.rejects(store.appendQuestionAndAnswer({
      userEmail: bob, threadId: thread.id, question: "Intrusion", engine: "opencode"
    }), ChatThreadNotFoundError);
    const retained = await store.getThreadDetail(alice, thread.id);
    assert.equal(retained?.title, "Updated title");
    assert.equal(retained?.messages.length, 2);
    assert.deepEqual(retained?.messages.find((message) => message.role === "assistant")?.stream, stream);
  });

  await t.test("serializes concurrent writes and persists error traces", async () => {
    const results = await Promise.all([alice, bob].map((userEmail) => store.appendQuestionAndAnswer({
      userEmail, question: "Concurrent request", engine: "opencode", model: "openai/gpt-5.5",
      openAiRoute: "openrouter",
      errorResponse: { ok: false, error: "Provider unavailable", details: ["Try later"], code: "UPSTREAM" },
      assistantStream: stream
    })));
    for (const result of results) {
      const assistant = result.messages.find((message) => message.role === "assistant");
      assert.equal(assistant?.status, "error");
      assert.equal(assistant?.errorCode, "UPSTREAM");
      assert.deepEqual(assistant?.stream, stream);
    }
    assert.equal((await store.listThreadSummaries(alice)).length, 2);
    assert.equal((await store.listThreadSummaries(bob)).length, 1);
    assert.deepEqual(database.sqlite.pragma("foreign_key_check"), []);
  });

  await t.test("rolls back the entire exchange when an assistant write fails", async () => {
    const before = await store.getThreadDetail(alice, thread.id);
    database.sqlite.exec(`create temp trigger reject_assistant before insert on chat_messages
      when new.role = 'assistant' begin select raise(abort, 'test write failure'); end`);
    try {
      await assert.rejects(store.appendQuestionAndAnswer({
        userEmail: alice, threadId: thread.id, question: "Must roll back", engine: "opencode",
        errorResponse: { ok: false, error: "Failed" }, assistantStream: stream
      }), /test write failure/);
    } finally {
      database.sqlite.exec("drop trigger reject_assistant");
    }
    assert.deepEqual(await store.getThreadDetail(alice, thread.id), before);
  });

  await t.test("new chats persist API defaults when callers omit model and route", async () => {
    const defaults = await store.appendQuestionAndAnswer({
      userEmail: "defaults@example.test", question: "Use defaults", engine: "opencode",
      successResponse: { ok: true, backend: "opencode", mode: "agent", question: "Use defaults", answer: "Done", sources: [] }
    });
    assert.equal(defaults.model, "openai/gpt-5.5");
    assert.equal(defaults.openAiRoute, "openrouter");
    assert.equal((await store.getThreadDetail("defaults@example.test", defaults.id))?.openAiRoute, "openrouter");
  });

  await t.test("cascades thread deletion through messages and traces", () => {
    database.sqlite.prepare("delete from chat_threads where id = ?").run(thread.id);
    const messageCount = database.sqlite.prepare("select count(*) as count from chat_messages where thread_id = ?").get(thread.id) as { count: number };
    assert.equal(messageCount.count, 0);
    assert.deepEqual(database.sqlite.pragma("foreign_key_check"), []);
    const traceCount = database.sqlite.prepare("select count(*) as count from chat_message_traces").get() as { count: number };
    assert.equal(traceCount.count, 2);
  });
});
