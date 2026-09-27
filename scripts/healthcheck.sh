#!/usr/bin/env bash

set -euo pipefail

WEB_URL="${WEB_URL:-http://web:3000/api/status}"
OPENCODE_URL="${OPENCODE_URL:-http://opencode-query:8282/health}"
SYNC_WORKER_URL="${SYNC_WORKER_URL:-http://sync-worker:4000/health}"

curl -fsS "${WEB_URL}" >/dev/null
curl -fsS "${SYNC_WORKER_URL}" >/dev/null

curl -fsS "${OPENCODE_URL}" >/dev/null
