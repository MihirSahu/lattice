import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { loadOpenAiAuth, parseOpenAiAuthJson } from "../src/openai-auth.ts";

const directAuth = {
  type: "oauth",
  refresh: "refresh-secret",
  access: "access-secret",
  expires: 1777769584483
} as const;

test("parseOpenAiAuthJson parses a direct OpenAI auth object", () => {
  assert.deepEqual(parseOpenAiAuthJson(JSON.stringify(directAuth), "direct"), directAuth);
});

test("parseOpenAiAuthJson parses a full OpenCode auth file", () => {
  assert.deepEqual(
    parseOpenAiAuthJson(
      JSON.stringify({
        anthropic: {
          type: "oauth",
          refresh: "anthropic-refresh",
          access: "anthropic-access",
          expires: 1
        },
        openai: directAuth
      }),
      "auth.json"
    ),
    directAuth
  );
});

test("parseOpenAiAuthJson rejects malformed auth without leaking token values", () => {
  assert.throws(
    () =>
      parseOpenAiAuthJson(
        JSON.stringify({
          type: "oauth",
          refresh: "refresh-secret",
          access: "access-secret",
          expires: "not-a-number"
        }),
        "OPENCODE_OPENAI_AUTH_JSON"
      ),
    (error) => {
      assert(error instanceof Error);
      assert.match(error.message, /numeric expires/);
      assert.doesNotMatch(error.message, /refresh-secret|access-secret/);
      return true;
    }
  );
});

test("loadOpenAiAuth prefers explicit file auth over env JSON", async () => {
  const dir = await mkdtemp(join(tmpdir(), "opencode-auth-test-"));
  const authPath = join(dir, "auth.json");
  const fileAuth = {
    ...directAuth,
    refresh: "file-refresh",
    access: "file-access",
    expires: directAuth.expires + 1
  };
  await writeFile(authPath, JSON.stringify({ openai: fileAuth }));

  const loaded = await loadOpenAiAuth({
    OPENCODE_OPENAI_AUTH_FILE: authPath,
    OPENCODE_OPENAI_AUTH_JSON: JSON.stringify(directAuth),
    HOME: join(dir, "home")
  });

  assert.equal(loaded?.source, "file");
  assert.equal(loaded?.path, authPath);
  assert.deepEqual(loaded?.auth, fileAuth);
});

test("loadOpenAiAuth uses mounted default auth before env JSON", async () => {
  const home = await mkdtemp(join(tmpdir(), "opencode-auth-home-"));
  const authDir = join(home, ".local", "share", "opencode");
  await mkdir(authDir, { recursive: true });
  const defaultAuth = {
    ...directAuth,
    refresh: "default-refresh",
    access: "default-access"
  };
  await writeFile(join(authDir, "auth.json"), JSON.stringify({ openai: defaultAuth }));

  const loaded = await loadOpenAiAuth({
    OPENCODE_OPENAI_AUTH_JSON: JSON.stringify(directAuth),
    HOME: home
  });

  assert.equal(loaded?.source, "default-auth-file");
  assert.deepEqual(loaded?.auth, defaultAuth);
});
