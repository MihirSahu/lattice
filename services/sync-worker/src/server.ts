import { spawn } from "node:child_process";
import { createWriteStream } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import path from "node:path";

type RunTrigger = string;

type CurrentRunStatus = {
  running: boolean;
  runId: string | null;
  trigger: string | null;
  startedAt: string | null;
  finishedAt: string | null;
};

type SyncStatus = {
  lastAttemptAt: string | null;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  lastResult: string;
  summary: string;
  changedFiles: number;
  fileCount: number;
  deleteEnabled: boolean;
  logPath: string | null;
  error: string | null;
};

type IndexStatus = {
  lastUpdateAt: string | null;
  lastEmbedAt: string | null;
  embeddingsPending: number;
  lastEmbedStrategy: string;
  lastUpdateSummary: Record<string, string> | null;
  lastEmbedSummary: Record<string, string> | null;
};

type ServicesStatus = {
  syncWorkerHealthy: boolean;
  qmdHealthy: boolean;
  opencodeHealthy: boolean;
};

type StatusPayload = {
  app: string;
  currentRun: CurrentRunStatus;
  sync: SyncStatus;
  index: IndexStatus;
  services: ServicesStatus;
};

type RunningJob = {
  runId: string;
  trigger: string;
  startedAt: string;
  logFilePath: string;
};

type SummaryMap = Record<string, string>;
type RunRequestBody = { trigger?: unknown };

const port = Number(process.env.SYNC_WORKER_PORT || 4000);
const statusDir = process.env.STATUS_DIR || "/var/lib/lattice";
const statusFile = path.join(statusDir, "status.json");
const logDir = process.env.LOG_DIR || "/var/log/lattice";
const qmdServiceUrl = process.env.QMD_SERVICE_URL || "http://qmd:8181";
const opencodeQueryServiceUrl = process.env.OPENCODE_QUERY_SERVICE_URL || "http://opencode-query:8282";
const embedStrategy = process.env.QMD_EMBED_STRATEGY || "on-change";

let runningJob: RunningJob | null = null;

function initialStatus(): StatusPayload {
  return {
    app: "Lattice",
    currentRun: {
      running: false,
      runId: null,
      trigger: null,
      startedAt: null,
      finishedAt: null
    },
    sync: {
      lastAttemptAt: null,
      lastSuccessAt: null,
      lastFailureAt: null,
      lastResult: "never-run",
      summary: "No sync has completed yet.",
      changedFiles: 0,
      fileCount: 0,
      deleteEnabled: false,
      logPath: null,
      error: null
    },
    index: {
      lastUpdateAt: null,
      lastEmbedAt: null,
      embeddingsPending: 0,
      lastEmbedStrategy: embedStrategy,
      lastUpdateSummary: null,
      lastEmbedSummary: null
    },
    services: {
      syncWorkerHealthy: true,
      qmdHealthy: false,
      opencodeHealthy: false
    }
  };
}

async function ensureDirs() {
  await mkdir(statusDir, { recursive: true });
  await mkdir(logDir, { recursive: true });
}

async function loadStatus(): Promise<StatusPayload> {
  await ensureDirs();

  try {
    const raw = await readFile(statusFile, "utf8");
    return JSON.parse(raw) as StatusPayload;
  } catch {
    const status = initialStatus();
    await writeStatus(status);
    return status;
  }
}

async function writeStatus(status: StatusPayload) {
  await ensureDirs();
  await writeFile(statusFile, JSON.stringify(status, null, 2));
}

async function mutateStatus(mutator: (status: StatusPayload) => StatusPayload | Promise<StatusPayload>) {
  const status = await loadStatus();
  const next = await mutator(status);
  await writeStatus(next);
  return next;
}

function readJsonBody(req: IncomingMessage): Promise<RunRequestBody> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];

    req.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    req.on("end", () => {
      if (chunks.length === 0) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")) as RunRequestBody);
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

function respond(res: ServerResponse, status: number, payload: unknown) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function parseSummaryLines(buffer: string): SummaryMap {
  const summary: SummaryMap = {};
  const lines = buffer
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  for (const line of lines) {
    const separator = line.indexOf("=");

    if (separator === -1) {
      continue;
    }

    const key = line.slice(0, separator);
    const value = line.slice(separator + 1);
    summary[key] = value;
  }

  return summary;
}

function runScript(scriptPath: string, logFilePath: string): Promise<SummaryMap> {
  return new Promise((resolve, reject) => {
    const child = spawn("bash", [scriptPath], {
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"]
    });
    const logStream = createWriteStream(logFilePath, { flags: "a" });
    let stdout = "";

    child.stdout.on("data", (chunk) => {
      const text = chunk.toString("utf8");
      stdout += text;
      logStream.write(text);
    });

    child.stderr.on("data", (chunk) => {
      logStream.write(chunk.toString("utf8"));
    });

    child.on("error", (error) => {
      logStream.end();
      reject(error);
    });

    child.on("close", (code) => {
      logStream.end();
      const summary = parseSummaryLines(stdout);

      if (code === 0) {
        resolve(summary);
        return;
      }

      reject(new Error(`Script failed (${path.basename(scriptPath)}) with exit code ${code}`));
    });
  });
}

function shouldRunEmbed(strategy: string, changedFiles: number) {
  if (strategy === "always") {
    return true;
  }

  if (strategy === "never" || strategy === "manual") {
    return false;
  }

  return changedFiles > 0;
}

async function refreshQmd() {
  try {
    const response = await fetch(`${qmdServiceUrl}/admin/reload`, {
      method: "POST"
    });

    return response.ok;
  } catch {
    return false;
  }
}

async function resolveQmdHealth() {
  try {
    const response = await fetch(`${qmdServiceUrl}/health`);
    return response.ok;
  } catch {
    return false;
  }
}

async function resolveOpencodeHealth() {
  try {
    const response = await fetch(`${opencodeQueryServiceUrl}/health`);
    return response.ok;
  } catch {
    return false;
  }
}

async function executeRun(trigger: RunTrigger) {
  if (runningJob) {
    return runningJob;
  }

  const runId = `${Date.now()}`;
  const startedAt = new Date().toISOString();
  const logFilePath = path.join(logDir, `sync-${runId}.log`);
  runningJob = { runId, trigger, startedAt, logFilePath };

  await mutateStatus((status) => {
    status.currentRun = {
      running: true,
      runId,
      trigger,
      startedAt,
      finishedAt: null
    };
    status.sync.lastAttemptAt = startedAt;
    status.sync.logPath = logFilePath;
    status.sync.error = null;
    return status;
  });

  try {
    const syncSummary = await runScript("/app/scripts/sync-vault.sh", logFilePath);
    const changedFiles = Number(syncSummary.CHANGED_FILES || 0);
    const fileCount = Number(syncSummary.MIRROR_FILE_COUNT || 0);

    const updateSummary = await runScript("/app/scripts/run-qmd-update.sh", logFilePath);
    const needsEmbedding = Number(updateSummary.NEEDS_EMBEDDING || changedFiles || 0);

    let embedRan = false;
    let embedSummary: SummaryMap | null = null;
    let embeddingsPending = needsEmbedding;

    if (shouldRunEmbed(embedStrategy, changedFiles)) {
      embedSummary = await runScript("/app/scripts/run-qmd-embed.sh", logFilePath);
      embedRan = true;
      embeddingsPending = 0;
    }

    const finishedAt = new Date().toISOString();
    const qmdHealthy = await refreshQmd();
    const opencodeHealthy = await resolveOpencodeHealth();

    await mutateStatus((status) => {
      status.currentRun = {
        running: false,
        runId,
        trigger,
        startedAt,
        finishedAt
      };
      status.sync.lastResult = "success";
      status.sync.lastSuccessAt = finishedAt;
      status.sync.summary = changedFiles > 0
        ? `Vault sync completed with ${changedFiles} changed files.`
        : "Vault sync completed with no file changes.";
      status.sync.changedFiles = changedFiles;
      status.sync.fileCount = fileCount;
      status.sync.deleteEnabled = syncSummary.SYNC_DELETE_ENABLED === "true";
      status.sync.logPath = logFilePath;
      status.sync.error = null;
      status.index.lastUpdateAt = finishedAt;
      status.index.lastUpdateSummary = updateSummary;
      status.index.lastEmbedStrategy = embedStrategy;
      status.index.embeddingsPending = embeddingsPending;

      if (embedRan) {
        status.index.lastEmbedAt = finishedAt;
        status.index.lastEmbedSummary = embedSummary;
      }

      status.services.qmdHealthy = qmdHealthy;
      status.services.opencodeHealthy = opencodeHealthy;
      return status;
    });
  } catch (error) {
    const finishedAt = new Date().toISOString();
    const message = error instanceof Error ? error.message : "Unknown error";

    await mutateStatus((status) => {
      status.currentRun = {
        running: false,
        runId,
        trigger,
        startedAt,
        finishedAt
      };
      status.sync.lastResult = "failure";
      status.sync.lastFailureAt = finishedAt;
      status.sync.summary = "Vault sync failed.";
      status.sync.error = message;
      status.sync.logPath = logFilePath;
      return status;
    });
  } finally {
    runningJob = null;
  }

  return { runId };
}

const server = createServer(async (req, res) => {
  try {
    if (!req.url) {
      respond(res, 400, { error: "Missing URL" });
      return;
    }

    const url = new URL(req.url, `http://127.0.0.1:${port}`);

    if (req.method === "GET" && url.pathname === "/health") {
      const qmdHealthy = await resolveQmdHealth();
      const opencodeHealthy = await resolveOpencodeHealth();
      const status = await mutateStatus((current) => {
        current.services.syncWorkerHealthy = true;
        current.services.qmdHealthy = qmdHealthy;
        current.services.opencodeHealthy = opencodeHealthy;
        return current;
      });
      respond(res, 200, { ok: true, services: status.services });
      return;
    }

    if (req.method === "GET" && url.pathname === "/status") {
      const qmdHealthy = await resolveQmdHealth();
      const opencodeHealthy = await resolveOpencodeHealth();
      const status = await mutateStatus((current) => {
        current.services.syncWorkerHealthy = true;
        current.services.qmdHealthy = qmdHealthy;
        current.services.opencodeHealthy = opencodeHealthy;
        return current;
      });
      respond(res, 200, status);
      return;
    }

    if (req.method === "POST" && url.pathname === "/run") {
      const body = await readJsonBody(req);
      const trigger = typeof body.trigger === "string" ? body.trigger : "manual";

      if (runningJob) {
        respond(res, 202, {
          ok: true,
          accepted: false,
          message: "A sync is already running.",
          currentRun: runningJob
        });
        return;
      }

      void executeRun(trigger);
      respond(res, 202, {
        ok: true,
        accepted: true,
        message: "Sync started."
      });
      return;
    }

    respond(res, 404, { error: "Not found" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    respond(res, 500, { error: message });
  }
});

server.listen(port, "0.0.0.0", async () => {
  const qmdHealthy = await resolveQmdHealth();
  const opencodeHealthy = await resolveOpencodeHealth();
  await mutateStatus((status) => {
    status.services.syncWorkerHealthy = true;
    status.services.qmdHealthy = qmdHealthy;
    status.services.opencodeHealthy = opencodeHealthy;
    return status;
  });
  console.log(`Sync worker listening on :${port}`);
});
