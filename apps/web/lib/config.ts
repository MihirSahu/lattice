export const config = {
  syncWorkerUrl: process.env.WEB_SYNC_WORKER_URL || "http://sync-worker:4000",
  qmdServiceUrl: process.env.WEB_QMD_SERVICE_URL || "http://qmd:8181",
  opencodeServiceUrl: process.env.WEB_OPENCODE_SERVICE_URL || "http://opencode-query:8282",
  defaultQueryLimit: Number(process.env.WEB_DEFAULT_QUERY_LIMIT || 6)
};
