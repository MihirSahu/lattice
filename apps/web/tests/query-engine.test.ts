import assert from "node:assert/strict";
import test from "node:test";
import { executeQueryEngineRequest } from "../lib/server/query-engine.ts";

test("query proxy never forwards stale caller model or route selections", async (t) => {
  let forwarded: Record<string, unknown> | undefined;
  t.mock.method(globalThis, "fetch", async (_url: unknown, options: RequestInit) => {
    forwarded = JSON.parse(String(options.body));
    return Response.json({ ok: true, backend: "opencode", mode: "agent", model: "openai/gpt-6-luna", openAiRoute: "openrouter", question: "Question", answer: "Answer", sources: [] });
  });
  const staleSettings = { model: "openai/gpt-5.5", openAiRoute: "subscription" };
  const result = await executeQueryEngineRequest({ ...staleSettings, engine: "opencode", question: "Question", folder: "notes", limit: 3 });
  assert.equal(result.ok, true);
  assert.deepEqual(forwarded, { question: "Question", folder: "notes", limit: 3 });
});
