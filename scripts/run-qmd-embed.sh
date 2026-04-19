#!/usr/bin/env bash

set -euo pipefail

: "${QMD_DB_PATH:?QMD_DB_PATH is required}"
: "${VAULT_MIRROR_DIR:?VAULT_MIRROR_DIR is required}"

echo "Running qmd embed against ${QMD_DB_PATH}" >&2
node /app/services/sync-worker/dist/qmd-admin.js embed
