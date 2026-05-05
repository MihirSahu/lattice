import assert from "node:assert/strict";
import test from "node:test";
import { copyTextToClipboard } from "../lib/clipboard.ts";

function setGlobalProperty(name: "document" | "navigator", value: unknown) {
  const previousDescriptor = Object.getOwnPropertyDescriptor(globalThis, name);

  Object.defineProperty(globalThis, name, {
    configurable: true,
    value
  });

  return () => {
    if (previousDescriptor) {
      Object.defineProperty(globalThis, name, previousDescriptor);
    } else {
      delete (globalThis as Record<string, unknown>)[name];
    }
  };
}

function createFakeDocument(execCommand: (command: string) => boolean) {
  const appended: Array<Record<string, unknown>> = [];
  const textarea = {
    readOnly: false,
    removed: false,
    selected: false,
    selectionRange: null as [number, number] | null,
    style: {} as Record<string, string>,
    value: "",
    focus() {},
    remove() {
      this.removed = true;
    },
    select() {
      this.selected = true;
    },
    setAttribute(name: string, value: string) {
      this[name as keyof typeof this] = value as never;
    },
    setSelectionRange(start: number, end: number) {
      this.selectionRange = [start, end];
    }
  };

  return {
    appended,
    textarea,
    document: {
      activeElement: null,
      body: {
        appendChild(node: Record<string, unknown>) {
          appended.push(node);
        }
      },
      contains() {
        return true;
      },
      createElement(tagName: string) {
        assert.equal(tagName, "textarea");
        return textarea;
      },
      execCommand,
      getSelection() {
        return null;
      }
    }
  };
}

test("copyTextToClipboard uses navigator clipboard when it succeeds", async () => {
  const calls: string[] = [];
  const restoreNavigator = setGlobalProperty("navigator", {
    clipboard: {
      async writeText(value: string) {
        calls.push(value);
      }
    }
  });
  const restoreDocument = setGlobalProperty("document", {
    execCommand() {
      throw new Error("fallback should not run");
    }
  });

  try {
    assert.equal(await copyTextToClipboard("hello"), true);
    assert.deepEqual(calls, ["hello"]);
  } finally {
    restoreDocument();
    restoreNavigator();
  }
});

test("copyTextToClipboard falls back when navigator clipboard is unavailable", async () => {
  const execCommands: string[] = [];
  const fakeDocument = createFakeDocument((command) => {
    execCommands.push(command);
    return true;
  });
  const restoreNavigator = setGlobalProperty("navigator", {});
  const restoreDocument = setGlobalProperty("document", fakeDocument.document);

  try {
    assert.equal(await copyTextToClipboard("mobile text"), true);
    assert.equal(fakeDocument.textarea.value, "mobile text");
    assert.equal(fakeDocument.textarea.selected, true);
    assert.deepEqual(fakeDocument.textarea.selectionRange, [0, "mobile text".length]);
    assert.deepEqual(execCommands, ["copy"]);
    assert.equal(fakeDocument.textarea.removed, true);
  } finally {
    restoreDocument();
    restoreNavigator();
  }
});

test("copyTextToClipboard falls back when navigator clipboard rejects", async () => {
  const execCommands: string[] = [];
  const fakeDocument = createFakeDocument((command) => {
    execCommands.push(command);
    return true;
  });
  const restoreNavigator = setGlobalProperty("navigator", {
    clipboard: {
      async writeText() {
        throw new Error("permission denied");
      }
    }
  });
  const restoreDocument = setGlobalProperty("document", fakeDocument.document);

  try {
    assert.equal(await copyTextToClipboard("fallback text"), true);
    assert.deepEqual(execCommands, ["copy"]);
    assert.equal(fakeDocument.textarea.value, "fallback text");
  } finally {
    restoreDocument();
    restoreNavigator();
  }
});

test("copyTextToClipboard returns false when both copy paths fail", async () => {
  const fakeDocument = createFakeDocument(() => false);
  const restoreNavigator = setGlobalProperty("navigator", {});
  const restoreDocument = setGlobalProperty("document", fakeDocument.document);

  try {
    assert.equal(await copyTextToClipboard("uncopied"), false);
  } finally {
    restoreDocument();
    restoreNavigator();
  }
});
