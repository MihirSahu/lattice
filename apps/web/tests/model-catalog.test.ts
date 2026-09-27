import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_MODEL_ID, OPENCODE_MODELS } from "@lattice/model-catalog";
import { askRequestSchema, chatAskRequestSchema, opencodeModelsResponseSchema, sourceFoldersResponseSchema } from "../lib/schemas.ts";
import { isSupportedOpencodeModel } from "../lib/chat-local-state.ts";

test("every shared catalog entry is accepted by API schemas and saved model normalization", () => {
  const response = opencodeModelsResponseSchema.parse({
    ok: true,
    models: OPENCODE_MODELS.map((model) => ({ ...model, isDefault: model.id === DEFAULT_MODEL_ID }))
  });
  assert.equal(response.models.filter((model) => model.isDefault).length, 1);
  for (const model of response.models) {
    assert.equal(isSupportedOpencodeModel(model.id), true);
  }
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
