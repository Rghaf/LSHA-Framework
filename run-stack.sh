#!/usr/bin/env bash
# Convenience wrapper around `docker compose` that also manages the native
# UPPAAL bridge (see uppaal-bridge/README.md).
#
# verifyta cannot run inside the container — UPPAAL 5.x's licence check
# segfaults there — so the real binary has to stay on the host, reached over
# HTTP by a shim mounted into the container. That means it can't be started
# as a `docker-compose.yml` service; this script is the next best thing:
#
#   ./run-stack.sh up --build      # starts the bridge, then the stack, in one command
#   ./run-stack.sh up -d --build   # same, detached — bridge is left running for you
#   ./run-stack.sh down            # any other subcommand passes straight through
#
# Ctrl-C / a foreground `up` exiting stops the bridge along with the stack.
# Detached mode leaves it running, since the containers still need it.
set -uo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BRIDGE_DIR="$HERE/uppaal-bridge"
BRIDGE_LOG="$BRIDGE_DIR/bridge.log"
BRIDGE_PID=""
STARTED_BY_US=false

# Same literal-parse as run-bridge.sh (not `source`d — other .env entries
# contain characters bash would try to interpret).
UPPAAL_BRIDGE_PORT="8899"
if [ -f "$HERE/.env" ]; then
  while IFS= read -r line; do
    key="${line%%=*}"
    value="${line#*=}"
    [ "$key" = "UPPAAL_BRIDGE_PORT" ] && UPPAAL_BRIDGE_PORT="$value"
  done < <(grep -E '^UPPAAL_[A-Z0-9_]+=' "$HERE/.env")
fi

log() { echo "[run-stack] $*"; }

bridge_healthy() {
  if command -v curl >/dev/null 2>&1; then
    curl -sf "http://127.0.0.1:${UPPAAL_BRIDGE_PORT}/health" >/dev/null 2>&1
  else
    # curl-less fallback: just check the port is accepting connections.
    (exec 3<>"/dev/tcp/127.0.0.1/${UPPAAL_BRIDGE_PORT}") 2>/dev/null
  fi
}

start_bridge() {
  if bridge_healthy; then
    log "UPPAAL bridge already running on :${UPPAAL_BRIDGE_PORT} — leaving it alone."
    return 0
  fi

  log "Starting UPPAAL bridge (native, host-side)..."
  "$BRIDGE_DIR/run-bridge.sh" >"$BRIDGE_LOG" 2>&1 &
  BRIDGE_PID=$!
  STARTED_BY_US=true

  for _ in 1 2 3 4 5 6 7 8 9 10; do
    if ! kill -0 "$BRIDGE_PID" 2>/dev/null; then
      log "Bridge exited immediately — see $BRIDGE_LOG:"
      cat "$BRIDGE_LOG" >&2
      return 1
    fi
    bridge_healthy && { log "Bridge is up (pid $BRIDGE_PID)."; return 0; }
    sleep 1
  done

  log "WARNING: bridge did not report healthy within 10s — continuing anyway, see $BRIDGE_LOG"
  return 0
}

stop_bridge() {
  $STARTED_BY_US || return 0
  [ -n "$BRIDGE_PID" ] || return 0
  kill -0 "$BRIDGE_PID" 2>/dev/null || return 0
  log "Stopping UPPAAL bridge (pid $BRIDGE_PID)..."
  kill "$BRIDGE_PID" 2>/dev/null
  wait "$BRIDGE_PID" 2>/dev/null
}

if [ "${1:-}" = "up" ]; then
  detached=false
  for a in "$@"; do
    case "$a" in
      -d|--detach) detached=true ;;
    esac
  done

  start_bridge || exit 1

  if $detached; then
    docker compose "$@"
    rc=$?
    if [ $rc -eq 0 ] && $STARTED_BY_US; then
      log "Stack started detached. UPPAAL bridge left running (pid $BRIDGE_PID, log: $BRIDGE_LOG)."
      log "Stop it later with: kill $BRIDGE_PID"
    elif [ $rc -ne 0 ] && $STARTED_BY_US; then
      log "docker compose failed — stopping the bridge we just started."
      stop_bridge
    fi
    exit $rc
  else
    trap stop_bridge EXIT INT TERM
    docker compose "$@"
    exit $?
  fi
else
  exec docker compose "$@"
fi
