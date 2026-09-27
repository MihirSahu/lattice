import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { mkdtemp, mkdir, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

type CompletionRequest = {
  model?: string;
  stream?: boolean;
  reasoning?: { effort?: string };
  messages?: Array<{ role: string; content?: unknown }>;
  tools?: Array<{ function?: { name?: string } }>;
};

function killProcessGroup(child: ChildProcess) {
  if (!child.pid || child.exitCode !== null || child.signalCode !== null) return;
  try {
    process.kill(-child.pid, "SIGKILL");
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "EPERM") child.kill("SIGTERM");
    else if (code !== "ESRCH") throw error;
  }
}

test("native worker reads a vault note using only Luna via OpenRouter despite legacy overrides", { timeout: 45_000 }, async () => {
  const repo = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
  // Canonicalize macOS /var symlinks so OpenCode recognizes the note as in scope.
  const root = await realpath(await mkdtemp(join(tmpdir(), "lattice-luna-runtime-")));
  const vault = join(root, "vault");
  const marker = "Synthetic Luna integration note: violet lighthouse.";
  const answer = "The synthetic note says violet lighthouse.";
  const requests: CompletionRequest[] = [];
  let toolCalls = 0;
  let toolResultSeen = false;
  let mockFailure: Error | null = null;
  let child: ChildProcess | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const server = createServer(async (request, response) => {
    try {
      assert.equal(request.url, "/api/v1/chat/completions");
      let body = "";
      for await (const chunk of request) body += chunk;
      const payload = JSON.parse(body) as CompletionRequest;
      requests.push(payload);
      assert.equal(payload.model, "openai/gpt-6-luna");
      assert.equal(payload.reasoning?.effort, "none");
      const hasReadTool = payload.tools?.some((tool) => tool.function?.name === "read");
      const hasNoteResult = payload.messages?.some((message) =>
        message.role === "tool" && JSON.stringify(message.content).includes(marker)
      );
      if (hasNoteResult) toolResultSeen = true;
      const shouldRead = hasReadTool && !hasNoteResult;
      if (shouldRead) {
        toolCalls++;
        assert.equal(toolCalls, 1, "The next completion must include the successful read result.");
      }
      const base = {
        id: `chatcmpl-local-luna-${requests.length}`,
        object: payload.stream ? "chat.completion.chunk" : "chat.completion",
        created: Math.floor(Date.now() / 1000),
        model: payload.model
      };
      const toolCall = {
        id: "call_read_synthetic_note", type: "function",
        function: { name: "read", arguments: JSON.stringify({ filePath: join(vault, "note.md") }) }
      };
      const usage = { prompt_tokens: 20, completion_tokens: 12, total_tokens: 32 };
      if (payload.stream) {
        response.writeHead(200, { "content-type": "text/event-stream" });
        const deltas = shouldRead
          ? [{ role: "assistant", tool_calls: [{ index: 0, ...toolCall }] }]
          : [{ role: "assistant", content: answer }];
        for (const delta of deltas) {
          response.write(`data: ${JSON.stringify({ ...base, choices: [{ index: 0, delta, finish_reason: null }] })}\n\n`);
        }
        response.write(`data: ${JSON.stringify({ ...base, choices: [{ index: 0, delta: {}, finish_reason: shouldRead ? "tool_calls" : "stop" }], usage })}\n\n`);
        response.end("data: [DONE]\n\n");
      } else {
        response.writeHead(200, { "content-type": "application/json" });
        response.end(JSON.stringify({ ...base, choices: [{ index: 0,
          message: shouldRead ? { role: "assistant", content: null, tool_calls: [toolCall] } : { role: "assistant", content: answer },
          finish_reason: shouldRead ? "tool_calls" : "stop"
        }], usage }));
      }
    } catch (error) {
      mockFailure = error instanceof Error ? error : new Error(String(error));
      response.writeHead(400, { "content-type": "application/json" });
      response.end(JSON.stringify({ error: { message: mockFailure.message } }));
    }
  });

  try {
    await Promise.all([mkdir(join(root, "bin")), mkdir(vault)]);
    await writeFile(join(vault, "note.md"), marker);
    // Use the installed native executable directly, avoiding global launchers/configuration.
    await symlink(await realpath(join(repo, "services/opencode-query/node_modules/opencode-ai/bin/opencode.exe")), join(root, "bin/opencode"));
    await new Promise<void>((resolveListen, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolveListen);
    });
    const address = server.address();
    assert(address && typeof address !== "string");
    const config = join(root, "opencode.json");
    await writeFile(config, JSON.stringify({
      plugin: [], autoupdate: false, share: "disabled", lsp: false,
      provider: { openrouter: { options: {
        baseURL: `http://127.0.0.1:${address.port}/api/v1`, apiKey: "local-test-placeholder"
      } } }
    }));
    child = spawn(process.execPath, [
      join(repo, "services/opencode-query/dist/query-worker.js")
    ], {
      cwd: vault, detached: true, stdio: ["pipe", "pipe", "pipe"],
      // Deliberately do not inherit credentials, proxies, or user OpenCode settings.
      env: {
        PATH: `${join(root, "bin")}:/usr/bin:/bin`, HOME: join(root, "home"),
        XDG_CONFIG_HOME: join(root, "config"), XDG_DATA_HOME: join(root, "data"),
        XDG_CACHE_HOME: join(root, "cache"), XDG_STATE_HOME: join(root, "state"), TMPDIR: root,
        OPENCODE_TEST_HOME: join(root, "home"), OPENCODE_TEST_MANAGED_CONFIG_DIR: join(root, "managed"),
        OPENCODE_CONFIG_DIR: join(root, "config"), OPENCODE_CONFIG: config, OPENCODE_AUTH_CONTENT: "{}",
        OPENCODE_DISABLE_AUTOUPDATE: "true", OPENCODE_DISABLE_MODELS_FETCH: "true",
        OPENCODE_DISABLE_DEFAULT_PLUGINS: "true", OPENCODE_DISABLE_PROJECT_CONFIG: "true",
        OPENCODE_DISABLE_CLAUDE_CODE: "true", OPENCODE_DISABLE_EXTERNAL_SKILLS: "true",
        OPENCODE_DISABLE_LSP_DOWNLOAD: "true", OPENCODE_DISABLE_SHARE: "true",
        OPENCODE_EXPERIMENTAL_DISABLE_FILEWATCHER: "true", OPENROUTER_API_KEY: "local-test-placeholder",
        VAULT_MIRROR_DIR: vault, OPENCODE_PROMPT_HEARTBEAT_MS: "1000",
        OPENCODE_MODEL: "anthropic/claude-opus-4.6", OPENCODE_OPENAI_ROUTE: "subscription",
        OPENCODE_OPENAI_AUTH_FILE: join(root, "nonexistent-auth.json")
      }
    });
    const runningChild = child;
    let stdout = "";
    let stderr = "";
    runningChild.stdout!.on("data", (chunk) => { stdout += chunk; });
    runningChild.stderr!.on("data", (chunk) => { stderr += chunk; });
    const completion = new Promise<number | null>((resolveExit, reject) => {
      runningChild.once("error", reject);
      runningChild.once("close", resolveExit);
      timer = setTimeout(() => {
        killProcessGroup(runningChild);
        reject(new Error(`Native worker exceeded 40 seconds.\n${stderr}`));
      }, 40_000);
    });
    runningChild.stdin!.end(JSON.stringify({
      question: "Read note.md and report its contents.", requestId: "local-luna-integration",
      model: "openai/gpt-5.5", openAiRoute: "subscription"
    }));
    const code = await completion;
    if (mockFailure) throw mockFailure;
    assert.equal(code, 0, stderr);
    const events = stdout.trim().split("\n").map((line) => JSON.parse(line));
    const final = events.find((event) => event.type === "final");
    assert.equal(final?.result?.answer, answer, stdout);
    assert.equal(events.find((event) => event.type === "session")?.model, "openai/gpt-6-luna");
    assert.equal(toolCalls, 1);
    assert.equal(toolResultSeen, true, "The real read tool must return the synthetic vault content.");
    assert.ok(requests.length >= 2, "Tool use requires a follow-up completion.");
  } finally {
    if (timer) clearTimeout(timer);
    if (child) {
      killProcessGroup(child);
      child.stdin?.destroy();
      child.stdout?.destroy();
      child.stderr?.destroy();
    }
    await new Promise<void>((resolveClose) => {
      server.close(() => resolveClose());
      server.closeAllConnections();
    });
    await rm(root, { recursive: true, force: true });
  }
});
