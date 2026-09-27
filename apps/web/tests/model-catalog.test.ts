import assert from "node:assert/strict";
import test from "node:test";
import { askRequestSchema, chatAskRequestSchema, chatThreadPatchRequestSchema, sourceFoldersResponseSchema } from "../lib/schemas.ts";

test("query contracts discard stale model and route selections", () => {
  const request = { question: "Summarize my notes", engine: "opencode", model: "anthropic/claude-opus-4.6", openAiRoute: "subscription" };
  assert.deepEqual(askRequestSchema.parse(request), { question: request.question, engine: "opencode" });
  assert.deepEqual(chatAskRequestSchema.parse(request), { question: request.question, engine: "opencode" });
  assert.equal(chatThreadPatchRequestSchema.safeParse({ model: request.model, openAiRoute: request.openAiRoute }).success, false);
  assert.deepEqual(chatThreadPatchRequestSchema.parse({ title: "Renamed", model: request.model, openAiRoute: request.openAiRoute }), { title: "Renamed" });
});

test("new query requests reject the retired QMD engine", () => {
  const request = { question: "Summarize my notes", engine: "qmd" };
  assert.equal(askRequestSchema.safeParse(request).success, false);
  assert.equal(chatAskRequestSchema.safeParse(request).success, false);
  assert.equal(chatAskRequestSchema.safeParse({ ...request, engine: "opencode" }).success, true);
});

test("source folders accept the OpenCode response without an index collection", () => {
  const response = { ok: true, folders: [{ id: "notes", title: "Notes", path: "notes", depth: 1 }] };
  assert.deepEqual(sourceFoldersResponseSchema.parse(response), response);
});
