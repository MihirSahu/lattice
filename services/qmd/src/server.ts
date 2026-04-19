import { randomUUID } from "node:crypto";
import { mkdir, readdir } from "node:fs/promises";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { dirname, join } from "node:path";
import { createStore } from "@tobilu/qmd";

type SearchResult = {
  docid?: string;
  id?: string;
  title?: string;
  path?: string;
  displayPath?: string;
  snippet?: string;
  text?: string;
  preview?: string;
  score?: number;
  context?: string | null;
};

type SourceFolder = {
  id: string;
  title: string;
  path: string;
  depth: number;
};

type QueryBody = {
  question?: unknown;
  folder?: unknown;
  limit?: unknown;
};

type QmdStore = Awaited<ReturnType<typeof createStore>>;

const port = Number(process.env.QMD_PORT || 8181);
const dbPath = process.env.QMD_DB_PATH || "/var/lib/qmd/index.sqlite";
const collection = process.env.QMD_COLLECTION || "vault";
const collectionPath = process.env.VAULT_MIRROR_DIR || "/srv/vault-mirror";
const resultLimit = Number(process.env.QMD_RESULT_LIMIT || 6);

let storePromise: Promise<QmdStore> | undefined;

function baseConfig() {
  return {
    collections: {
      [collection]: {
        path: collectionPath,
        pattern: "**/*.{md,markdown,txt}"
      }
    }
  };
}

async function ensureStore() {
  if (!storePromise) {
    await mkdir(dirname(dbPath), { recursive: true });
    storePromise = createStore({
      dbPath,
      config: baseConfig()
    });
  }

  return storePromise;
}

async function reloadStore() {
  if (storePromise) {
    const active = await storePromise;
    await active.close();
  }

  storePromise = undefined;
  return ensureStore();
}

async function readBody(request: IncomingMessage): Promise<QueryBody> {
  const chunks: Buffer[] = [];

  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  if (chunks.length === 0) {
    return {};
  }

  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as QueryBody;
}

function normalizeResult(result: SearchResult, index: number) {
  return {
    id: result.docid || result.id || `result-${index + 1}`,
    title: result.title || result.path || result.displayPath || `Result ${index + 1}`,
    path: result.displayPath || result.path || null,
    snippet: result.snippet || result.text || result.preview || "",
    score: typeof result.score === "number" ? result.score : null,
    context: result.context || null
  };
}

function normalizeFolderPath(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value
    .trim()
    .replaceAll("\\", "/")
    .replace(/^\/+/, "")
    .replace(/\/+$/, "");

  return normalized || null;
}

function matchesFolder(path: string | null, folder: string | null) {
  if (!folder) {
    return true;
  }

  const normalizedPath = normalizeFolderPath(path);

  if (!normalizedPath) {
    return false;
  }

  return normalizedPath === folder || normalizedPath.startsWith(`${folder}/`);
}

async function listSourceFolders(rootPath: string, maxDepth = 2) {
  const folders: SourceFolder[] = [];

  async function walk(currentPath: string, segments: string[]) {
    if (segments.length >= maxDepth) {
      return;
    }

    const entries = await readdir(currentPath, { withFileTypes: true });
    const directories = entries
      .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
      .sort((left, right) => left.name.localeCompare(right.name));

    for (const directory of directories) {
      const nextSegments = [...segments, directory.name];
      const relativePath = nextSegments.join("/");

      folders.push({
        id: relativePath,
        title: nextSegments.join(" / "),
        path: relativePath,
        depth: nextSegments.length
      });

      await walk(join(currentPath, directory.name), nextSegments);
    }
  }

  await walk(rootPath, []);

  return folders;
}

function buildRetrievalAnswer(results: Array<ReturnType<typeof normalizeResult>>) {
  if (results.length === 0) {
    return "No matching notes were found in the current vault mirror.";
  }

  const excerptLines = results
    .slice(0, 3)
    .map((result) => {
      const header = result.title;
      const snippet = result.snippet || "Relevant note matched, but no snippet was returned.";
      return `${header}: ${snippet}`.trim();
    });

  return excerptLines.join("\n\n");
}

function respond(res: ServerResponse, status: number, payload: unknown) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function previewQuestion(value: string) {
  const normalized = value.replace(/\s+/g, " ").trim();

  if (normalized.length <= 120) {
    return normalized;
  }

  return `${normalized.slice(0, 119)}…`;
}

function getRequestId(req: IncomingMessage) {
  const headerValue = req.headers["x-request-id"];
  const requestId = Array.isArray(headerValue) ? headerValue[0] : headerValue;
  return requestId?.trim() || randomUUID().slice(0, 8);
}

const server = createServer(async (req, res) => {
  const requestId = getRequestId(req);
  const startedAt = Date.now();

  try {
    if (!req.url) {
      res.writeHead(400).end("Missing URL");
      return;
    }

    const url = new URL(req.url, `http://127.0.0.1:${port}`);

    if (req.method === "GET" && url.pathname === "/health") {
      await ensureStore();
      respond(res, 200, {
        ok: true,
        collection,
        dbPath
      });
      return;
    }

    if (req.method === "GET" && url.pathname === "/status") {
      const store = await ensureStore();
      const collections = await store.listCollections();

      respond(res, 200, {
        ok: true,
        collection,
        dbPath,
        collections
      });
      return;
    }

    if (req.method === "GET" && url.pathname === "/sources") {
      const folders = await listSourceFolders(collectionPath);

      respond(res, 200, {
        ok: true,
        collection,
        folders
      });
      return;
    }

    if (req.method === "POST" && url.pathname === "/admin/reload") {
      await reloadStore();
      respond(res, 200, { ok: true, reloadedAt: new Date().toISOString() });
      return;
    }

    if (req.method === "POST" && url.pathname === "/query") {
      const body = await readBody(req);
      const question = typeof body.question === "string" ? body.question.trim() : "";
      const limit = typeof body.limit === "number" ? body.limit : resultLimit;
      const folder = normalizeFolderPath(body.folder);

      if (!question) {
        respond(res, 400, { error: "Question is required." });
        return;
      }

      console.log(
        `[qmd:${requestId}] start folder=${folder ?? "<all>"} limit=${limit} question="${previewQuestion(question)}"`
      );

      const store = await ensureStore();
      const results = await store.search({
        query: question,
        collection,
        limit: folder ? Math.max(limit * 10, 50) : limit
      });
      const normalized = (results as SearchResult[])
        .map(normalizeResult)
        .filter((result) => matchesFolder(result.path, folder))
        .slice(0, limit);

      console.log(
        `[qmd:${requestId}] finish duration_ms=${Date.now() - startedAt} results=${normalized.length}`
      );

      respond(res, 200, {
        ok: true,
        backend: "qmd",
        mode: "retrieval",
        question,
        folder,
        duration_ms: Date.now() - startedAt,
        answer: buildRetrievalAnswer(normalized),
        sources: normalized
      });
      return;
    }

    respond(res, 404, { error: "Not found" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(`[qmd:${requestId}] error duration_ms=${Date.now() - startedAt} message="${message}"`);
    respond(res, 500, { error: message });
  }
});

server.listen(port, "0.0.0.0", () => {
  console.log(`QMD service listening on :${port}`);
});
