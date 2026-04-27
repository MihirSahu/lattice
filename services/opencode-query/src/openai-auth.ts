import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

export type OpenAiOAuthAuth = {
  type: "oauth";
  refresh: string;
  access: string;
  expires: number;
  enterpriseUrl?: string;
};

export type LoadedOpenAiAuth = {
  auth: OpenAiOAuthAuth;
  source: "file" | "env" | "default-auth-file";
  path?: string;
  expires: number;
};

type OpenAiAuthEnv = {
  [key: string]: string | undefined;
  OPENCODE_OPENAI_AUTH_FILE?: string;
  OPENCODE_OPENAI_AUTH_JSON?: string;
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

  if (typeof record.expires !== "number" || !Number.isFinite(record.expires)) {
    throw new Error(`${sourceLabel} OpenAI auth is missing a numeric expires timestamp.`);
  }

  const auth: OpenAiOAuthAuth = {
    type: "oauth",
    refresh: record.refresh,
    access: record.access,
    expires: record.expires
  };

  if (typeof record.enterpriseUrl === "string" && record.enterpriseUrl.trim()) {
    auth.enterpriseUrl = record.enterpriseUrl;
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

  const authJson = env.OPENCODE_OPENAI_AUTH_JSON?.trim();

  if (!authJson) {
    return null;
  }

  const auth = parseOpenAiAuthJson(authJson, "OPENCODE_OPENAI_AUTH_JSON");

  return {
    auth,
    source: "env",
    expires: auth.expires
  };
}

export async function hasOpenAiAuth(env: OpenAiAuthEnv = process.env) {
  try {
    return Boolean(await loadOpenAiAuth(env));
  } catch {
    return false;
  }
}
