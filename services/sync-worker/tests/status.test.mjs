import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

// Exercise the actual service against a legacy status file, with no AWS calls.
test("status keeps sync history and drops retired indexing fields", { timeout: 15000 }, async () => {
  const root = await mkdtemp(join(tmpdir(), "lattice-sync-status-"));
  const health = createServer((_req, res) => res.writeHead(200).end("{}"));
  health.listen(0, "127.0.0.1");
  await once(health, "listening");
  const statusFile = join(root, "status.json");
  await writeFile(statusFile, JSON.stringify({
    app: "Lattice", sync: { lastSuccessAt: "2026-01-01T00:00:00Z", fileCount: 42 },
    index: { embeddingsPending: 7 }, services: { qmdHealthy: true }
  }));
  const child = spawn(process.execPath, ["dist/server.js"], {
    cwd: new URL("..", import.meta.url),
    env: { PATH: process.env.PATH, SYNC_WORKER_PORT: "0", STATUS_DIR: root, LOG_DIR: root,
      OPENCODE_QUERY_SERVICE_URL: `http://127.0.0.1:${health.address().port}` },
    stdio: ["ignore", "pipe", "pipe"]
  });
  let stderr = "";
  child.stderr.on("data", chunk => { stderr += chunk; });
  const exited = once(child, "exit");
  try {
    const port = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`Startup timeout: ${stderr}`)), 10000);
      let output = "";
      child.stdout.on("data", chunk => {
        output += chunk;
        const match = output.match(/Sync worker listening on :(\d+)/);
        if (match) { clearTimeout(timer); resolve(Number(match[1])); }
      });
      child.once("error", error => { clearTimeout(timer); reject(error); });
      child.once("exit", code => { clearTimeout(timer); reject(new Error(`Exited ${code}: ${stderr}`)); });
    });
    const response = await fetch(`http://127.0.0.1:${port}/status`);
    assert.equal(response.status, 200);
    const status = await response.json();
    assert.equal(status.sync.lastSuccessAt, "2026-01-01T00:00:00Z");
    assert.equal(status.sync.fileCount, 42);
    assert.deepEqual(status.services, { syncWorkerHealthy: true, opencodeHealthy: true });
    assert.equal("index" in status, false);
    const saved = JSON.parse(await readFile(statusFile, "utf8"));
    assert.equal("index" in saved, false);
    assert.equal("qmdHealthy" in saved.services, false);
  } finally {
    child.kill("SIGTERM");
    await exited;
    health.closeAllConnections();
    await new Promise(resolve => health.close(resolve));
    await rm(root, { recursive: true, force: true });
  }
});
