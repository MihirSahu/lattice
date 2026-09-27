import assert from "node:assert/strict";
import { access, mkdir, mkdtemp, rm, symlink } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import test from "node:test";
import { createOpencodeClient, createOpencodeServer } from "@opencode-ai/sdk";

test("installed OpenCode CLI serves SDK session operations in an isolated local workspace", { timeout: 45000 }, async () => {
  const require = createRequire(import.meta.url);
  const packageRoot = dirname(require.resolve("opencode-ai/package.json"));
  // The installed package contains the native executable; never use a global CLI.
  const executable = join(packageRoot, "bin", "opencode.exe");
  await access(executable);
  const root = await mkdtemp(join(tmpdir(), "lattice-opencode-smoke-"));
  const previousEnv = process.env;
  const previousCwd = process.cwd();
  let server: Awaited<ReturnType<typeof createOpencodeServer>> | undefined;

  try {
    const bin = join(root, "bin");
    const workspace = join(root, "vault");
    await mkdir(bin);
    await mkdir(workspace);
    await symlink(executable, join(bin, "opencode"));

    // Replace, rather than extend, the environment so real provider credentials,
    // user configuration, and auth stores cannot leak into this smoke test.
    process.env = {
      PATH: `${bin}:/usr/bin:/bin`,
      HOME: join(root, "home"),
      XDG_CONFIG_HOME: join(root, "config"),
      XDG_DATA_HOME: join(root, "data"),
      XDG_CACHE_HOME: join(root, "cache"),
      XDG_STATE_HOME: join(root, "state"),
      TMPDIR: root,
      OPENCODE_TEST_HOME: join(root, "home"),
      OPENCODE_TEST_MANAGED_CONFIG_DIR: join(root, "managed"),
      OPENCODE_CONFIG_DIR: join(root, "config"),
      OPENCODE_AUTH_CONTENT: "{}",
      OPENCODE_DISABLE_AUTOUPDATE: "true",
      OPENCODE_DISABLE_MODELS_FETCH: "true",
      OPENCODE_DISABLE_DEFAULT_PLUGINS: "true",
      OPENCODE_DISABLE_PROJECT_CONFIG: "true",
      OPENCODE_DISABLE_CLAUDE_CODE: "true",
      OPENCODE_DISABLE_EXTERNAL_SKILLS: "true",
      OPENCODE_DISABLE_LSP_DOWNLOAD: "true",
      OPENCODE_DISABLE_SHARE: "true",
      OPENCODE_EXPERIMENTAL_DISABLE_FILEWATCHER: "true"
    };
    process.chdir(workspace);
    server = await createOpencodeServer({
      hostname: "127.0.0.1",
      port: 0,
      timeout: 20000,
      config: { plugin: [], autoupdate: false, share: "disabled", enabled_providers: [], lsp: false }
    });
    assert.equal(new URL(server.url).hostname, "127.0.0.1");
    assert.notEqual(new URL(server.url).port, "0");

    const health = await fetch(`${server.url}/global/health`, { signal: AbortSignal.timeout(5000) });
    assert.equal(health.status, 200);
    const healthBody = await health.json();
    assert.equal(healthBody.healthy, true);
    assert.equal(healthBody.version, require("opencode-ai/package.json").version);

    const client = createOpencodeClient({ baseUrl: server.url });
    const session = await client.session.create({
      query: { directory: workspace },
      body: { title: "Local SDK compatibility smoke test" },
      throwOnError: true
    });
    assert.ok(session.data?.id);
    assert.equal(session.data.title, "Local SDK compatibility smoke test");
    const sessionId = session.data.id;
    const fetched = await client.session.get({
      path: { id: sessionId }, query: { directory: workspace }, throwOnError: true
    });
    assert.equal(fetched.data?.id, sessionId);
    const deleted = await client.session.delete({
      path: { id: sessionId }, query: { directory: workspace }, throwOnError: true
    });
    assert.equal(deleted.data, true);
    const remaining = await client.session.list({ query: { directory: workspace }, throwOnError: true });
    assert.ok(remaining.data);
    assert.equal(remaining.data.some((item) => item.id === sessionId), false);
    // No prompt or provider endpoint is called: this verifies lifecycle and SDK compatibility only.
  } finally {
    server?.close();
    try {
      if (server) {
        let closed = false;
        for (let attempt = 0; attempt < 100; attempt += 1) {
          try {
            await fetch(`${server.url}/global/health`, { signal: AbortSignal.timeout(100) });
          } catch {
            closed = true;
            break;
          }
          await delay(50);
        }
        assert.ok(closed, "OpenCode server should stop after SDK close()");
      }
    } finally {
      process.chdir(previousCwd);
      process.env = previousEnv;
      await rm(root, { recursive: true, force: true });
    }
  }
});
