export type WebAuthMode = "auto" | "cloudflare" | "dev";

function parseWebAuthMode(value: string | undefined): WebAuthMode {
  switch (value?.trim().toLowerCase()) {
    case "cloudflare":
      return "cloudflare";
    case "dev":
      return "dev";
    case "auto":
    default:
      return "auto";
  }
}

export const config = {
  syncWorkerUrl: process.env.WEB_SYNC_WORKER_URL || "http://sync-worker:4000",
  qmdServiceUrl: process.env.WEB_QMD_SERVICE_URL || "http://qmd:8181",
  opencodeServiceUrl: process.env.WEB_OPENCODE_SERVICE_URL || "http://opencode-query:8282",
  defaultQueryLimit: Number(process.env.WEB_DEFAULT_QUERY_LIMIT || 6),
  chatDbPath: process.env.CHAT_DB_PATH || "/var/lib/lattice/chat/chat.sqlite",
  webAuthMode: parseWebAuthMode(process.env.WEB_AUTH_MODE),
  webDevUserEmail: process.env.WEB_DEV_USER_EMAIL || ""
};
