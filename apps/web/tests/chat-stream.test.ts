import assert from "node:assert/strict";
import test from "node:test";
import { parseChatAskStreamEvent, readNdjsonStream } from "../lib/chat-stream.ts";
import { encodeNdjsonEvent, NdjsonLineParser } from "../lib/ndjson.ts";

test("NdjsonLineParser handles split lines and multiple events per chunk", () => {
  const parser = new NdjsonLineParser<unknown>();
  const events = [
    ...parser.push('{"type":"status","message":"start"}\n{"type":"reasoning_delta","text":"hel'),
    ...parser.push('lo"}\n\n{"type":"thinking","message":"step"}\n')
  ];

  assert.deepEqual(events, [
    { type: "status", message: "start" },
    { type: "reasoning_delta", text: "hello" },
    { type: "thinking", message: "step" }
  ]);
  assert.deepEqual(parser.flush(), []);
});

test("parseChatAskStreamEvent parses final chat payloads", () => {
  const event = parseChatAskStreamEvent({
    type: "final",
    response: {
      ok: true,
      thread: {
        id: "8774e6dc-6560-4107-aab6-76e0d34c97dc",
        title: "What changed?",
        createdAt: "2026-04-20T12:00:00.000Z",
        updatedAt: "2026-04-20T12:00:05.000Z",
        engine: "opencode",
        folder: "",
        model: "openai/gpt-5.5",
        messages: []
      }
    }
  });

  assert.equal(event.type, "final");
  assert.equal(event.response.thread.id, "8774e6dc-6560-4107-aab6-76e0d34c97dc");
});

test("parseChatAskStreamEvent parses stream error payloads", () => {
  const event = parseChatAskStreamEvent({
    type: "error",
    message: "OpenCode failed.",
    error: {
      ok: false,
      error: "OpenCode failed.",
      details: ["Provider message: failed"]
    }
  });

  assert.equal(event.type, "error");
  assert.equal(event.message, "OpenCode failed.");
  assert.deepEqual(event.error?.details, ["Provider message: failed"]);
});

test("parseChatAskStreamEvent passes through file access metadata", () => {
  const event = parseChatAskStreamEvent({
    type: "file_access",
    label: "Read notes/day.md.",
    files: [
      {
        path: "notes/day.md",
        operation: "read",
        lineStart: 10,
        lineEnd: 18,
        source: "symbol"
      }
    ],
    toolName: "read",
    toolUseId: "call-1"
  });

  assert.equal(event.type, "file_access");
  assert.deepEqual(event.files, [
    {
      path: "notes/day.md",
      operation: "read",
      lineStart: 10,
      lineEnd: 18,
      source: "symbol"
    }
  ]);
});

test("readNdjsonStream dispatches events from browser response chunks", async () => {
  const encoder = new TextEncoder();
  const chunks = [
    encoder.encode('{"type":"status","message":"start"}\n{"type":"reasoning_delta","text":"hel'),
    encoder.encode('lo"}\n'),
    encoder.encode(encodeNdjsonEvent({ type: "thinking", message: "step" }))
  ];
  const response = new Response(
    new ReadableStream({
      start(controller) {
        for (const chunk of chunks) {
          controller.enqueue(chunk);
        }

        controller.close();
      }
    })
  );
  const events: unknown[] = [];

  await readNdjsonStream(response, (value) => value, (event) => events.push(event));

  assert.deepEqual(events, [
    { type: "status", message: "start" },
    { type: "reasoning_delta", text: "hello" },
    { type: "thinking", message: "step" }
  ]);
});
