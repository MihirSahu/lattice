import assert from "node:assert/strict";
import type { ChildProcess } from "node:child_process";
import { EventEmitter } from "node:events";
import test from "node:test";
import { terminateProcessWithGrace } from "../dist/process-lifecycle.js";

class FakeChildProcess extends EventEmitter {
  exitCode: number | null = null;
  signalCode: NodeJS.Signals | null = null;
  signals: NodeJS.Signals[] = [];
  pid = 1234;

  kill(signal: NodeJS.Signals) {
    this.signals.push(signal);
    return true;
  }
}

function asChildProcess(child: FakeChildProcess) {
  return child as unknown as ChildProcess;
}

test("terminateProcessWithGrace sends SIGTERM and cancels escalation when the child closes", async () => {
  const child = new FakeChildProcess();

  terminateProcessWithGrace(asChildProcess(child), 10);
  assert.deepEqual(child.signals, ["SIGTERM"]);

  child.emit("close", 0, null);
  await new Promise((resolve) => setTimeout(resolve, 20));

  assert.deepEqual(child.signals, ["SIGTERM"]);
});

test("terminateProcessWithGrace escalates to SIGKILL after the grace period", async () => {
  const child = new FakeChildProcess();
  let forceKillCount = 0;

  terminateProcessWithGrace(asChildProcess(child), 5, () => {
    forceKillCount += 1;
  });
  await new Promise((resolve) => setTimeout(resolve, 20));

  assert.deepEqual(child.signals, ["SIGTERM", "SIGKILL"]);
  assert.equal(forceKillCount, 1);
});

test("terminateProcessWithGrace ignores an exited child", () => {
  const child = new FakeChildProcess();
  child.exitCode = 0;

  terminateProcessWithGrace(asChildProcess(child), 0);

  assert.deepEqual(child.signals, []);
});

test("terminateProcessWithGrace escalates the full process group after the worker exits", async () => {
  const child = new FakeChildProcess();
  const originalKill = process.kill;
  const groupSignals: Array<NodeJS.Signals | 0> = [];

  process.kill = ((pid: number, signal?: NodeJS.Signals | number) => {
    assert.equal(pid, -child.pid);
    groupSignals.push((signal ?? "SIGTERM") as NodeJS.Signals | 0);
    return true;
  }) as typeof process.kill;

  try {
    terminateProcessWithGrace(asChildProcess(child), 5, undefined, { processGroup: true });
    assert.deepEqual(groupSignals, [0, "SIGTERM"]);

    child.exitCode = 0;
    child.emit("close", 0, null);
    await new Promise((resolve) => setTimeout(resolve, 20));

    assert.deepEqual(groupSignals, [0, "SIGTERM", 0, "SIGKILL"]);
  } finally {
    process.kill = originalKill;
  }
});
