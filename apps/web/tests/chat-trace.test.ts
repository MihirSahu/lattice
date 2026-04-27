import assert from "node:assert/strict";
import test from "node:test";
import {
  applyStreamEventToState,
  createPendingAssistantStreamState,
  finalizeAssistantStreamState,
  hasAssistantStreamContent
} from "../lib/chat-trace.ts";

test("chat trace accumulates reasoning deltas", () => {
  let stream = createPendingAssistantStreamState();

  stream = applyStreamEventToState(stream, { type: "reasoning_delta", text: "Read " });
  stream = applyStreamEventToState(stream, { type: "reasoning_delta", text: "the notes." });

  assert.equal(stream.reasoningText, "Read the notes.");
  assert.equal(hasAssistantStreamContent(stream), true);
});

test("chat trace tracks tool lifecycle and clears active tool on finish", () => {
  let stream = createPendingAssistantStreamState();

  stream = applyStreamEventToState(stream, {
    type: "tool_start",
    toolName: "read",
    toolUseId: "call-1",
    label: "Read notes/day.md",
    inputSummary: "notes/day.md",
    files: [{ path: "notes/day.md", operation: "read", lineStart: 10, lineEnd: 18 }]
  });

  assert.equal(stream.activeTool?.toolUseId, "call-1");
  assert.equal(stream.files.length, 1);

  stream = applyStreamEventToState(stream, {
    type: "tool_finish",
    toolName: "read",
    toolUseId: "call-1",
    label: "Read complete",
    outputSummary: "Loaded notes/day.md",
    elapsedMs: 42,
    files: [{ path: "notes/day.md", operation: "read", lineStart: 10, lineEnd: 18 }]
  });

  assert.equal(stream.activeTool, null);
  assert.equal(stream.files.length, 1);
  assert.equal(stream.entries.at(-1)?.outputSummary, "Loaded notes/day.md");
});

test("chat trace records tool errors and finalization clears active tool", () => {
  let stream = createPendingAssistantStreamState();

  stream = applyStreamEventToState(stream, {
    type: "tool_start",
    toolName: "search",
    toolUseId: "call-2",
    label: "Search notes"
  });
  stream = applyStreamEventToState(stream, {
    type: "tool_error",
    toolName: "search",
    toolUseId: "call-2",
    label: "Search failed",
    error: "No index"
  });

  const finalized = finalizeAssistantStreamState({
    ...stream,
    activeTool: {
      toolName: "search",
      toolUseId: "call-2",
      label: "Search notes",
      startedAt: "2026-04-20T12:00:00.000Z"
    }
  });

  assert.equal(stream.error, "Search failed");
  assert.equal(finalized.activeTool, null);
});

test("chat trace caps entries and touched files", () => {
  let stream = createPendingAssistantStreamState();

  for (let index = 0; index < 85; index += 1) {
    stream = applyStreamEventToState(stream, { type: "status", message: `step-${index}` });
  }

  assert.equal(stream.entries.length, 80);
  assert.equal(stream.entries[0]?.label, "step-5");

  for (let index = 0; index < 45; index += 1) {
    stream = applyStreamEventToState(stream, {
      type: "file_access",
      label: `Read notes/${index}.md.`,
      files: [{ path: `notes/${index}.md`, operation: "read" }]
    });
  }

  assert.equal(stream.files.length, 40);
  assert.equal(stream.files[0]?.path, "notes/5.md");
});

test("chat trace dedupes repeated file references", () => {
  let stream = createPendingAssistantStreamState();

  for (let index = 0; index < 2; index += 1) {
    stream = applyStreamEventToState(stream, {
      type: "file_access",
      label: "Read notes/day.md.",
      files: [{ path: "notes/day.md", operation: "read", lineStart: 1, lineEnd: 4 }]
    });
  }

  assert.equal(stream.files.length, 1);
  assert.equal(hasAssistantStreamContent(createPendingAssistantStreamState()), false);
});
