#!/usr/bin/env bash

set -euo pipefail

: "${SYNC_S3_BUCKET:?SYNC_S3_BUCKET is required}"
: "${VAULT_MIRROR_DIR:?VAULT_MIRROR_DIR is required}"

SYNC_S3_PREFIX="${SYNC_S3_PREFIX:-}"
SYNC_DELETE="${SYNC_DELETE:-false}"
SYNC_AWS_REGION="${SYNC_AWS_REGION:-us-east-1}"

mkdir -p "${VAULT_MIRROR_DIR}"

snapshot_tree() {
  local target_dir="$1"
  if [ ! -d "${target_dir}" ]; then
    return 0
  fi

  find "${target_dir}" -type f -printf '%P|%s|%TY-%Tm-%TdT%TH:%TM:%TS\n' | sort
}

count_changed_files() {
  local before_file="$1"
  local after_file="$2"

  awk -F'|' '
    NR == FNR {
      before[$1] = $2 "|" $3
      next
    }
    {
      after[$1] = $2 "|" $3
    }
    END {
      count = 0
      for (path in before) {
        if (!(path in after) || before[path] != after[path]) {
          count++
        }
      }
      for (path in after) {
        if (!(path in before)) {
          count++
        }
      }
      print count + 0
    }
  ' "${before_file}" "${after_file}"
}

before_manifest="$(mktemp)"
after_manifest="$(mktemp)"
trap 'rm -f "${before_manifest}" "${after_manifest}"' EXIT

snapshot_tree "${VAULT_MIRROR_DIR}" > "${before_manifest}"

s3_uri="s3://${SYNC_S3_BUCKET}"
if [ -n "${SYNC_S3_PREFIX}" ]; then
  s3_uri="${s3_uri}/${SYNC_S3_PREFIX}"
fi

aws_args=(
  s3
  sync
  "${s3_uri}"
  "${VAULT_MIRROR_DIR}"
  --region "${SYNC_AWS_REGION}"
  --no-progress
)

if [ "${SYNC_DELETE}" = "true" ]; then
  aws_args+=(--delete)
fi

echo "Starting S3 sync from ${s3_uri} into ${VAULT_MIRROR_DIR}" >&2
aws "${aws_args[@]}" >&2

snapshot_tree "${VAULT_MIRROR_DIR}" > "${after_manifest}"

changed_files="$(count_changed_files "${before_manifest}" "${after_manifest}")"
file_count="$(find "${VAULT_MIRROR_DIR}" -type f | wc -l | tr -d ' ')"

echo "CHANGED_FILES=${changed_files}"
echo "MIRROR_FILE_COUNT=${file_count}"
echo "SYNC_DELETE_ENABLED=${SYNC_DELETE}"

