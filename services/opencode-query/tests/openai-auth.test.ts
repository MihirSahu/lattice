import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { loadOpenAiAuth, parseOpenAiAuthJson } from "../src/openai-auth.ts";

function createJwt(payload: Record<string, unknown>) {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "RS256", typ: "JWT" })}.${encode(payload)}.signature`;
}

const directAuth = {
  type: "oauth",
  refresh: "refresh-secret",
  access: "access-secret",
  expires: 1777769584483,
  accountId: "account-id"
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

test("parseOpenAiAuthJson derives missing expiry and account ID from access token", () => {
  const access = createJwt({
    exp: 1777769585,
    "https://api.openai.com/auth": {
      chatgpt_account_id: "jwt-account-id"
    }
  });

  assert.deepEqual(
    parseOpenAiAuthJson(
      JSON.stringify({
        type: "oauth",
        refresh: "refresh-secret",
        access
      }),
      "auth.json"
    ),
    {
      type: "oauth",
      refresh: "refresh-secret",
      access,
      expires: 1777769585000,
      accountId: "jwt-account-id"
    }
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

test("loadOpenAiAuth loads explicit file auth", async () => {
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
    HOME: join(dir, "home")
  });

  assert.equal(loaded?.source, "file");
  assert.equal(loaded?.path, authPath);
  assert.deepEqual(loaded?.auth, fileAuth);
});

test("loadOpenAiAuth uses mounted default auth", async () => {
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
    HOME: home
  });

  assert.equal(loaded?.source, "default-auth-file");
  assert.deepEqual(loaded?.auth, defaultAuth);
});

test("loadOpenAiAuth ignores OPENCODE_OPENAI_AUTH_JSON", async () => {
  const loaded = await loadOpenAiAuth({
    OPENCODE_OPENAI_AUTH_JSON: JSON.stringify(directAuth),
    HOME: await mkdtemp(join(tmpdir(), "opencode-auth-json-"))
  });

  assert.equal(loaded, null);
});
