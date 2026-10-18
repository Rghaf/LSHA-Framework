# UPPAAL bridge

Lets the Dockerised Celery worker run UPPAAL case studies (THERMO, HRI) even
though `verifyta` cannot execute inside a container.

## Why this exists

UPPAAL 5.x segfaults immediately when run in any Linux container on this setup.
`strace` shows it probing hardware-identity sources for its licence check —
`/dev/disk/by-uuid`, `/dev/disk/by-id`, network interfaces, `/etc/mtab` — and
then dereferencing NULL (`SIGSEGV {si_code=SEGV_MAPERR, si_addr=NULL}`) once
those come back empty or unrecognised.

This was reproduced with, and is **not** fixed by:

- bind-mounting the real `/opt/uppaal` and the activated licence directory
- `--security-opt seccomp=unconfined`, `--security-opt apparmor=unconfined`
- `--privileged`, `--pid=host`, full `/dev` and `/sys` mounts, `/etc/machine-id`
- genuine namespace escape, not just device access: `--privileged --pid=host
  --cgroupns=host --network=host --uts=host --ipc=host`, then `nsenter
  --target 1 --mount --uts --ipc --net --pid --
  /opt/uppaal/lib/app/bin/verifyta --version` — running the exact host binary,
  in the host's real mount/PID/network namespaces. Still segfaults (exit 139).

The same binary runs perfectly on the host. It is a defect in UPPAAL's
proprietary licensing code, not a Docker misconfiguration — so instead of
fighting it, `verifyta` stays on the host and the container calls out to it.

## How it works

```
  ┌──────────── container ────────────┐          ┌─────────── host ───────────┐
  │ dynamic_tracegenerator.py         │          │                            │
  │   subprocess.run([verifyta,       │          │  run-bridge.sh             │
  │     '-t0', model.xml, query.q])   │          │    └─ server.py :8899      │
  │            │                      │  HTTP    │         │                  │
  │            ▼                      │ ───────► │         ▼                  │
  │  /opt/uppaal/lib/app/bin/verifyta │ POST     │   real verifyta (native)   │
  │       (the ./verifyta shim)       │ /verify  │                            │
  │            ▲                      │ ◄─────── │                            │
  │     stdout / stderr / exit code   │  JSON    │                            │
  └───────────────────────────────────┘          └────────────────────────────┘
```

`verifyta` (the shim) is mounted over the expected binary path by
`docker-compose.yml`. It takes the same command line as the real binary, ships
the model and query **contents** to the bridge, and replays the returned stdout,
stderr and exit code. Nothing in `dynamic_tracegenerator.py` had to change.

## Usage

Activate the licence once, natively on the host:

```bash
/opt/uppaal/lib/app/bin/verifyta -k <your-licence-key>
```

Then, from the repo root, bring the stack up with the wrapper instead of raw
`docker compose` — it starts this bridge first (and stops it again when the
stack does):

```bash
./run-stack.sh up --build
```

If you'd rather manage the bridge's lifetime yourself — e.g. to keep it running
across several `docker compose` invocations — start it by hand in its own
terminal and use plain `docker compose` as usual:

```bash
./uppaal-bridge/run-bridge.sh   # leave running in its own terminal
docker compose up
```

Check it is reachable from inside the container:

```bash
docker compose exec backend /opt/uppaal/lib/app/bin/verifyta --version
# verifyta shim -> http://host.docker.internal:8899 (bridge reports /opt/uppaal/...)
```

CSV/SIM case studies (ENERGY, GREEN) never touch UPPAAL — they run fine with
the bridge stopped.

## Configuration

Set in the repo-root `.env`; the bridge and the shim read the same values.

| Variable | Default | Purpose |
|---|---|---|
| `UPPAAL_BIN` | `/opt/uppaal/lib/app/bin/verifyta` | Real binary, host-side |
| `UPPAAL_BRIDGE_PORT` | `8899` | Listen port |
| `UPPAAL_BRIDGE_TOKEN` | *(empty)* | Shared secret; auth is disabled if unset |
| `UPPAAL_BRIDGE_BIND` | `0.0.0.0` | Listen address |
| `UPPAAL_BRIDGE_TIMEOUT` | `600` | Per-invocation timeout, seconds |

`UPPAAL_BRIDGE_URL` is set for the containers by `docker-compose.yml` and points
at `host.docker.internal`, mapped to the host gateway via `extra_hosts`.

## Security notes

The bridge executes a local binary on behalf of network callers, so it is
deliberately narrow:

- only `UPPAAL_BIN` is ever executed — the request cannot name another program
- flags are checked against an allow-list regex; model and query arrive as
  **content**, are written to a private temp dir, and are passed as paths the
  bridge itself chose, so no argument injection is possible
- requests need a matching `X-Auth-Token`

It still binds `0.0.0.0` by default, because the container reaches the host
across a Docker bridge network where `127.0.0.1` is not routable. On an
untrusted network, set a strong `UPPAAL_BRIDGE_TOKEN` (the default `.env.example`
value is a placeholder), or pin `UPPAAL_BRIDGE_BIND` to your Docker gateway
address. This is a development tool — do not expose it to the public internet.
