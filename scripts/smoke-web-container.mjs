// Run inside the built web image; uses only synthetic data and a local mock backend.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

const directory = await mkdtemp(join(tmpdir(), "lattice-web-smoke-"));
const mock = createServer(async (request, response) => {
  for await (const chunk of request) { /* Drain the request body. */ }
  response.writeHead(200, { "content-type": "application/x-ndjson" });
  response.write(`${JSON.stringify({ type: "status", message: "Reading synthetic notes." })}\n`);
  response.end(`${JSON.stringify({ type: "final", result: {
    ok: true, backend: "opencode", mode: "agent", provider: "openrouter",
    model: "openai/gpt-6-luna", openAiRoute: "openrouter",
    question: "Synthetic question", answer: "Synthetic answer", sources: []
  } })}\n`);
});
const listen = (server) => new Promise((resolve, reject) => {
  server.once("error", reject);
  server.listen(0, "127.0.0.1", resolve);
});
let web;
let exited;
let output = "";

try {
  await listen(mock);
  const portProbe = createServer();
  await listen(portProbe);
  const port = portProbe.address().port;
  await new Promise((resolve) => portProbe.close(resolve));
  const gcHook = join(directory, "gc.cjs");
  // Force native statement destructors to run while the Next server is active.
  await writeFile(gcHook, "setInterval(() => global.gc(), 50).unref();\n");
  web = spawn(process.execPath, ["--expose-gc", "--require", gcHook, "server.js"], {
    cwd: process.argv[2] || "/app/apps/web",
    env: {
      PATH: process.env.PATH, HOME: directory, NODE_ENV: "production",
      HOSTNAME: "127.0.0.1", PORT: String(port),
      WEB_AUTH_MODE: "dev", WEB_DEV_USER_EMAIL: "smoke@example.test",
      CHAT_DB_PATH: join(directory, "chat.sqlite"),
      WEB_OPENCODE_SERVICE_URL: `http://127.0.0.1:${mock.address().port}`
    },
    stdio: ["ignore", "pipe", "pipe"]
  });
  exited = new Promise((resolve) => web.once("exit", resolve));
  web.stdout.on("data", (chunk) => { output += chunk; });
  web.stderr.on("data", (chunk) => { output += chunk; });
  const base = `http://127.0.0.1:${port}`;
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    if (web.exitCode !== null || web.signalCode !== null) throw new Error(output);
    try {
      const response = await fetch(`${base}/api/chat/threads`, { signal: AbortSignal.timeout(1000) });
      assert.equal(response.status, 200);
      assert.equal((await response.json()).threads.length, 0);
      ready = true;
      break;
    } catch { await delay(100); }
  }
  assert.ok(ready, `Web server did not become ready.\n${output}`);
  let threadId;
  for (let turn = 0; turn < 30; turn++) {
    const response = await fetch(`${base}/api/chat/ask`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ threadId, question: "Synthetic question", engine: "opencode" }),
      signal: AbortSignal.timeout(10000)
    });
    assert.equal(response.status, 200);
    const events = (await response.text()).trim().split("\n").map(JSON.parse);
    const final = events.at(-1);
    assert.equal(final.type, "final", JSON.stringify(final));
    assert.equal(final.response.ok, true, JSON.stringify(final));
    threadId = final.response.thread.id;
    assert.equal(final.response.thread.messages.length, (turn + 1) * 2);
    assert.equal(final.response.thread.messages.at(-1).response.answer, "Synthetic answer");
    await delay(60);
  }
  const saved = await fetch(`${base}/api/chat/threads/${threadId}`, { signal: AbortSignal.timeout(5000) });
  assert.equal((await saved.json()).thread.messages.length, 60);
  assert.equal(web.exitCode, null);
  assert.equal(web.signalCode, null);
  console.log(`Web image passed: 30 streamed and persisted chat turns under forced GC (${process.version}, ${process.platform}/${process.arch}).`);
} catch (error) {
  console.error(output);
  throw error;
} finally {
  if (web && web.exitCode === null && web.signalCode === null) {
    web.kill("SIGTERM");
    const forceKill = setTimeout(() => web.kill("SIGKILL"), 5000);
    await exited;
    clearTimeout(forceKill);
  }
  await new Promise((resolve) => {
    mock.close(resolve);
    mock.closeAllConnections();
  });
  await rm(directory, { recursive: true, force: true });
}
