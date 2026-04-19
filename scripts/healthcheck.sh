#!/usr/bin/env bash

set -euo pipefail

WEB_URL="${WEB_URL:-http://web:3000/api/status}"
QMD_URL="${QMD_URL:-http://qmd:8181/health}"
SYNC_WORKER_URL="${SYNC_WORKER_URL:-http://sync-worker:4000/health}"

curl -fsS "${WEB_URL}" >/dev/null
curl -fsS "${QMD_URL}" >/dev/null
curl -fsS "${SYNC_WORKER_URL}" >/dev/null

