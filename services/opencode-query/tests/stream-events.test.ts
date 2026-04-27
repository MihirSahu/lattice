import assert from "node:assert/strict";
import test from "node:test";
import { encodeNdjsonEvent, NdjsonLineParser, type WorkerStreamEvent } from "../src/stream-events.ts";
import { createOpenCodeEventMapper } from "../dist/query-worker.js";

test("NdjsonLineParser reconstructs split stream events", () => {
  const parser = new NdjsonLineParser<WorkerStreamEvent>();
  const events = [
    ...parser.push('{"type":"reasoning_delta","text":"hel'),
    ...parser.push('lo"}\n{"type":"tool_start","toolName":"read","toolUseId":"1","label":"Read file"}\n')
  ];

  assert.deepEqual(events, [
    { type: "reasoning_delta", text: "hello" },
    { type: "tool_start", toolName: "read", toolUseId: "1", label: "Read file" }
  ]);
  assert.deepEqual(parser.flush(), []);
});

test("NdjsonLineParser handles multiple events, blank lines, and final flush", () => {
  const parser = new NdjsonLineParser<WorkerStreamEvent>();
  const finalEvent = {
    type: "final",
    result: {
      ok: true,
      question: "What changed?",
      answer: "The answer.",
      sources: []
    }
  } satisfies WorkerStreamEvent;

  const events = parser.push(`${encodeNdjsonEvent({ type: "thinking", message: "Step started." })}\n${JSON.stringify(finalEvent)}`);

  assert.deepEqual(events, [{ type: "thinking", message: "Step started." }]);
  assert.deepEqual(parser.flush(), [finalEvent]);
});

test("NdjsonLineParser parses structured error events", () => {
  const parser = new NdjsonLineParser<WorkerStreamEvent>();
  const events = parser.push(
    encodeNdjsonEvent({
      type: "error",
      error: {
        ok: false,
        code: "provider_rate_limited",
        provider: "openrouter",
        error: "The model provider is rate-limiting requests right now."
      }
    })
  );

  assert.equal(events[0]?.type, "error");
  assert.deepEqual(events[0], {
    type: "error",
    error: {
      ok: false,
      code: "provider_rate_limited",
      provider: "openrouter",
      error: "The model provider is rate-limiting requests right now."
    }
  });
});

test("OpenCode event mapper emits tool metadata and file access from tool input", () => {
  const events: unknown[] = [];
  const mapEvent = createOpenCodeEventMapper("session-1", (event) => events.push(event));

  mapEvent({
    type: "message.part.updated",
    properties: {
      part: {
        id: "part-tool-1",
        sessionID: "session-1",
        messageID: "message-1",
        type: "tool",
        callID: "call-1",
        tool: "read",
        state: {
          status: "running",
          input: {
            path: "notes/day.md"
          },
          raw: '{"path":"notes/day.md"}',
          title: "Read notes/day.md",
          time: {
            start: 100
          }
        }
      }
    }
  });

  assert.deepEqual(events, [
    {
      type: "tool_start",
      toolName: "read",
      toolUseId: "call-1",
      label: "Read notes/day.md",
      status: "running",
      inputSummary: "path: notes/day.md",
      elapsedMs: undefined,
      outputSummary: undefined,
      files: [
        {
          path: "notes/day.md",
          operation: "read",
          source: "path"
        }
      ],
      error: undefined
    },
    {
      type: "file_access",
      label: "Using 1 file path.",
      files: [
        {
          path: "notes/day.md",
          operation: "read",
          source: "path"
        }
      ],
      toolName: "read",
      toolUseId: "call-1"
    }
  ]);
});

test("OpenCode event mapper emits file access and token details from file and step parts", () => {
  const events: unknown[] = [];
  const mapEvent = createOpenCodeEventMapper("session-1", (event) => events.push(event));

  mapEvent({
    type: "message.part.updated",
    properties: {
      part: {
        id: "part-file-1",
        sessionID: "session-1",
        messageID: "message-1",
        type: "file",
        mime: "text/markdown",
        url: "file:///srv/vault-mirror/notes/day.md",
        source: {
          type: "symbol",
          path: "/srv/vault-mirror/notes/day.md",
          range: {
            start: { line: 10, character: 0 },
            end: { line: 18, character: 1 }
          }
        }
      }
    }
  });
  mapEvent({
    type: "message.part.updated",
    properties: {
      part: {
        id: "part-step-1",
        sessionID: "session-1",
        messageID: "message-1",
        type: "step-finish",
        reason: "tool-calls-complete",
        cost: 0.0123,
        tokens: {
          input: 100,
          output: 20,
          reasoning: 5,
          cache: {
            read: 7,
            write: 2
          }
        }
      }
    }
  });

  assert.deepEqual(events, [
    {
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
      ]
    },
    {
      type: "thinking",
      message: "Finished a reasoning step: tool-calls-complete.",
      tokens: {
        input: 100,
        output: 20,
        reasoning: 5,
        cacheRead: 7,
        cacheWrite: 2
      },
      cost: 0.0123
    }
  ]);
});
