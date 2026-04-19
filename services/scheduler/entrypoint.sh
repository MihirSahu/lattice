#!/usr/bin/env bash

set -euo pipefail

SYNC_WORKER_URL="${SYNC_WORKER_URL:-http://sync-worker:4000}"
SYNC_INTERVAL_SECONDS="${SYNC_INTERVAL_SECONDS:-300}"
SCHEDULER_RUN_ON_START="${SCHEDULER_RUN_ON_START:-true}"

trigger_sync() {
  curl -fsS -X POST "${SYNC_WORKER_URL}/run" \
    -H 'content-type: application/json' \
    -d '{"trigger":"scheduler"}' >/dev/null || true
}

if [ "${SCHEDULER_RUN_ON_START}" = "true" ]; then
  trigger_sync
fi

while true; do
  sleep "${SYNC_INTERVAL_SECONDS}"
  trigger_sync
done
