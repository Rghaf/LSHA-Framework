#!/usr/bin/env bash
# Start the UPPAAL bridge on the HOST (not in Docker).
#
# Reads the UPPAAL_* keys from the repo-root .env so the bridge and the
# container-side shim always agree on port and token. The file is parsed
# literally rather than `source`d — other entries (e.g. DJANGO_SECRET_KEY)
# contain characters bash would otherwise try to interpret.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(dirname "$HERE")"

if [ -f "$ROOT/.env" ]; then
  while IFS= read -r line; do
    key="${line%%=*}"
    value="${line#*=}"
    export "$key=$value"
  done < <(grep -E '^UPPAAL_[A-Z0-9_]+=' "$ROOT/.env")
fi

export UPPAAL_BIN="${UPPAAL_BIN:-/opt/uppaal/lib/app/bin/verifyta}"
export UPPAAL_BRIDGE_PORT="${UPPAAL_BRIDGE_PORT:-8899}"
export UPPAAL_BRIDGE_BIND="${UPPAAL_BRIDGE_BIND:-0.0.0.0}"

exec python3 "$HERE/server.py"
