import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

export type OpenAiOAuthAuth = {
  type: "oauth";
  refresh: string;
  access: string;
  expires: number;
  accountId?: string;
  enterpriseUrl?: string;
};

export type LoadedOpenAiAuth = {
  auth: OpenAiOAuthAuth;
  source: "file" | "default-auth-file";
  path?: string;
  expires: number;
};

type OpenAiAuthEnv = {
  [key: string]: string | undefined;
  OPENCODE_OPENAI_AUTH_FILE?: string;
  XDG_DATA_HOME?: string;
  HOME?: string;
};

function getDefaultOpenCodeAuthFilePath(env: OpenAiAuthEnv = process.env) {
  const dataHome = env.XDG_DATA_HOME?.trim() || join(env.HOME?.trim() || homedir(), ".local", "share");
  return join(dataHome, "opencode", "auth.json");
}

function pickOpenAiAuthCandidate(value: unknown) {
  if (!value || typeof value !== "object") {
    return value;
  }

  const record = value as Record<string, unknown>;
  return record.openai && typeof record.openai === "object" ? record.openai : value;
}

function parseJwtPayload(token: string) {
  const [, payload] = token.split(".");

  if (!payload) {
    return null;
  }

  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function getJwtExpires(accessToken: string) {
  const payload = parseJwtPayload(accessToken);
  const exp = payload && typeof payload.exp === "number" && Number.isFinite(payload.exp) ? payload.exp : null;

  return exp === null ? null : exp * 1000;
}

function getJwtAccountId(accessToken: string) {
  const payload = parseJwtPayload(accessToken);
  const auth = payload?.["https://api.openai.com/auth"];

  if (!auth || typeof auth !== "object") {
    return null;
  }

  const accountId = (auth as Record<string, unknown>).chatgpt_account_id;

  return typeof accountId === "string" && accountId.trim() ? accountId : null;
}

export function parseOpenAiAuthJson(raw: string, sourceLabel: string): OpenAiOAuthAuth {
  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`${sourceLabel} must contain valid JSON.`);
  }

  const candidate = pickOpenAiAuthCandidate(parsed);

  if (!candidate || typeof candidate !== "object") {
    throw new Error(`${sourceLabel} must contain an OpenAI OAuth auth object.`);
  }

  const record = candidate as Record<string, unknown>;

  if (record.type !== "oauth") {
    throw new Error(`${sourceLabel} OpenAI auth must use type "oauth".`);
  }

  if (typeof record.refresh !== "string" || !record.refresh.trim()) {
    throw new Error(`${sourceLabel} OpenAI auth is missing a refresh token.`);
  }

  if (typeof record.access !== "string" || !record.access.trim()) {
    throw new Error(`${sourceLabel} OpenAI auth is missing an access token.`);
  }

  const expires = typeof record.expires === "number" && Number.isFinite(record.expires)
    ? record.expires
    : getJwtExpires(record.access);

  if (expires === null) {
    throw new Error(`${sourceLabel} OpenAI auth is missing a numeric expires timestamp.`);
  }

  const auth: OpenAiOAuthAuth = {
    type: "oauth",
    refresh: record.refresh,
    access: record.access,
    expires
  };

  if (typeof record.enterpriseUrl === "string" && record.enterpriseUrl.trim()) {
    auth.enterpriseUrl = record.enterpriseUrl;
  }

  const accountId = typeof record.accountId === "string" && record.accountId.trim()
    ? record.accountId
    : getJwtAccountId(record.access);

  if (accountId) {
    auth.accountId = accountId;
  }

  return auth;
}

async function loadOpenAiAuthFile(path: string, source: LoadedOpenAiAuth["source"]): Promise<LoadedOpenAiAuth | null> {
  if (!existsSync(path)) {
    return null;
  }

  const auth = parseOpenAiAuthJson(await readFile(path, "utf8"), path);

  return {
    auth,
    source,
    path,
    expires: auth.expires
  };
}

export async function loadOpenAiAuth(env: OpenAiAuthEnv = process.env): Promise<LoadedOpenAiAuth | null> {
  const explicitAuthFile = env.OPENCODE_OPENAI_AUTH_FILE?.trim();

  if (explicitAuthFile) {
    const loaded = await loadOpenAiAuthFile(explicitAuthFile, "file");

    if (!loaded) {
      throw new Error("OPENCODE_OPENAI_AUTH_FILE does not exist.");
    }

    return loaded;
  }

  const defaultAuth = await loadOpenAiAuthFile(getDefaultOpenCodeAuthFilePath(env), "default-auth-file");

  if (defaultAuth) {
    return defaultAuth;
  }

  return null;
}

export async function hasOpenAiAuth(env: OpenAiAuthEnv = process.env) {
  try {
    return Boolean(await loadOpenAiAuth(env));
  } catch {
    return false;
  }
}
