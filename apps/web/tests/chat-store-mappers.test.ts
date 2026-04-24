import assert from "node:assert/strict";
import test from "node:test";
import { chatAskRequestSchema, chatAskResponseSchema, chatThreadsResponseSchema } from "../lib/schemas.ts";
import { mapPersistedChatMessageRow, mapThreadDetail, mapThreadSummaryRow } from "../lib/server/chat-store-mappers.ts";

test("mapThreadSummaryRow maps persisted thread rows into API-safe summaries", () => {
  const summary = mapThreadSummaryRow({
    id: "0ff3dc7a-cfdf-4476-8a3c-d0ca9a2e0e8b",
    title: "How does sync work?",
    engine: "opencode",
    folder: "notes/infra",
    model: "openai/gpt-5",
    createdAt: "2026-04-20T12:00:00.000Z",
    updatedAt: "2026-04-20T12:00:05.000Z"
  });

  assert.equal(summary.title, "How does sync work?");
  assert.equal(summary.engine, "opencode");
  assert.equal(summary.model, "openai/gpt-5");
});

test("mapPersistedChatMessageRow restores success and error payloads from serialized JSON", () => {
  const successMessage = mapPersistedChatMessageRow({
    id: "53ad4a54-4c2c-46fe-8c16-a75060c7bf48",
    role: "assistant",
    status: "complete",
    createdAt: "2026-04-20T12:00:10.000Z",
    question: null,
    responseJson: JSON.stringify({
      ok: true,
      backend: "qmd",
      mode: "answer",
      question: "What changed?",
      answer: "The index was refreshed.",
      sources: []
    }),
    errorText: null,
    errorDetailsJson: null,
    errorCode: null
  });

  assert.equal(successMessage.response?.answer, "The index was refreshed.");

  const errorMessage = mapPersistedChatMessageRow({
    id: "6edb5544-f1dd-4970-8f5f-67f64263dc7b",
    role: "assistant",
    status: "error",
    createdAt: "2026-04-20T12:00:15.000Z",
    question: null,
    responseJson: null,
    errorText: "Upstream timeout",
    errorDetailsJson: JSON.stringify({
      ok: false,
      error: "Upstream timeout",
      details: ["The OpenCode backend timed out."],
      code: "TIMEOUT"
    }),
    errorCode: "TIMEOUT"
  });

  assert.deepEqual(errorMessage.errorDetails, ["The OpenCode backend timed out."]);
  assert.equal(errorMessage.errorCode, "TIMEOUT");
});

test("mapThreadDetail composes ordered messages into the full thread payload", () => {
  const detail = mapThreadDetail(
    {
      id: "d43ddc7d-80b0-472a-9608-2d5bdfdce47f",
      title: "New chat",
      engine: "qmd",
      folder: "",
      model: null,
      createdAt: "2026-04-20T12:00:00.000Z",
      updatedAt: "2026-04-20T12:00:20.000Z"
    },
    [
      {
        id: "8eaf2a72-c4cf-4b4b-b0c8-d8d56db8652d",
        role: "user",
        status: "complete",
        createdAt: "2026-04-20T12:00:01.000Z",
        question: "What changed?",
        responseJson: null,
        errorText: null,
        errorDetailsJson: null,
        errorCode: null
      }
    ]
  );

  assert.equal(detail.messages.length, 1);
  assert.equal(detail.messages[0]?.question, "What changed?");
});

test("chat request and response schemas parse persisted chat API contracts", () => {
  const request = chatAskRequestSchema.parse({
    question: "Summarize the latest sync",
    engine: "opencode",
    folder: "notes",
    model: "openai/gpt-5"
  });

  const response = chatAskResponseSchema.parse({
    ok: true,
    thread: {
      id: "fc628a6c-e2e6-4c2e-a7f0-dfc7a3ee24fd",
      title: "Summarize the latest sync",
      createdAt: "2026-04-20T12:00:00.000Z",
      updatedAt: "2026-04-20T12:00:05.000Z",
      engine: "opencode",
      folder: "notes",
      model: "openai/gpt-5",
      messages: []
    }
  });

  assert.equal(request.engine, "opencode");
  assert.equal(response.thread.folder, "notes");
});

test("chat thread list schema includes the authenticated user identity", () => {
  const response = chatThreadsResponseSchema.parse({
    ok: true,
    userEmail: "developer@example.com",
    threads: []
  });

  assert.equal(response.userEmail, "developer@example.com");
});
