#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [[ -f "${SCRIPT_DIR}/scripts/nikkos-d-check.mjs" ]]; then
  exec node "${SCRIPT_DIR}/scripts/nikkos-d-check.mjs" "$@"
elif [[ -f "${SCRIPT_DIR}/_tools/nikkos-d-check/nikkos-d-check.mjs" ]]; then
  exec node "${SCRIPT_DIR}/_tools/nikkos-d-check/nikkos-d-check.mjs" "$@"
else
  exec node "/run/media/zeus/6TB-1/__GITHUB NUC/_tools/nikkos-d-check/nikkos-d-check.mjs" "$@"
fi
