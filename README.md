# LSHA-framework

A monorepo pairing two independently-versioned projects:

| Directory | What it is | Upstream repo |
|---|---|---|
| `backend/` | Django + Celery REST API wrapping the L\*SHA learning algorithm | `Rghaf/LSHA-Re-engineered` |
| `frontend/` | React + Vite UI for submitting case studies and viewing results | `Rghaf/LSHA-Web-Application` |

Each keeps its own `.git` history; this top level only adds the files needed to run
both together via Docker Compose.

---

## Quick start

Requires Docker Engine + the Compose plugin (see "Installing Docker" below if you
don't have it yet).

```bash
cp .env.example .env        # edit values if needed — safe defaults are pre-filled

docker compose up --build
```

That one command starts everything: Redis, the Django backend, the Celery worker,
and the frontend. Which frontend you get is controlled by `COMPOSE_PROFILES` in
`.env` (defaults to `dev` — Vite hot reload). To get the Nginx production build
instead, either change `COMPOSE_PROFILES=prod` in `.env`, or override it for one run
without editing the file:

```bash
COMPOSE_PROFILES=prod docker compose up --build
```

- Backend API: http://localhost:8000
- Django admin: http://localhost:8000/admin
- **Celery dashboard (Flower): http://localhost:5555**
- Frontend (dev profile): http://localhost:5173
- Frontend (prod profile): http://localhost:80
- Redis: localhost:6379

Backend code, `db.sqlite3`, `media/`, `results/`, and `case_files/` are bind-mounted
from `backend/` on the host, so data and code changes persist across
`docker compose up`/`down` and Django's auto-reloader picks up edits immediately.

---

## Watching what the algorithm is doing

Learning runs happen in the Celery worker, not the API, so their output does not
appear in the browser. Two ways to watch:

**Live logs.** Start the stack in the foreground and every service's output is
interleaved in the terminal:

```bash
docker compose up                 # Ctrl-C stops the stack
```

Or, when running detached (`-d`), follow one service:

```bash
docker compose logs -f celery-worker      # the learning pipeline
docker compose logs -f                    # everything
docker compose logs --tail 100 celery-worker
```

Output streams in real time — the image sets `PYTHONUNBUFFERED=1`, without which
Python block-buffers and task output only lands once the task ends. Logs rotate at
20 MB × 5 files per service, since a single run can emit thousands of lines.

**Flower dashboard — http://localhost:5555.** A live web view of the queue: which
tasks are running, their arguments, runtime, return value, and full tracebacks for
failures. Survives restarts (`--persistent`, stored in `backend/results/flower.db`)
so past runs stay inspectable. The worker runs with `-E` so it emits the task
events Flower needs.

It is also queryable, which is handy for scripting:

```bash
curl -s localhost:5555/api/workers | python3 -m json.tool
curl -s localhost:5555/api/tasks   | python3 -m json.tool
```

To password-protect it, add `FLOWER_BASIC_AUTH=user:pass` to `.env`. The compose file
sets `FLOWER_UNAUTHENTICATED_API=True` so the JSON API works without credentials —
remove that line if you ever expose port 5555 beyond localhost.

---

## Vendored algorithm packages

`backend/core_algorithm/` contains four in-tree packages that the learning pipeline
imports. They had been committed as bare git *gitlinks* with no `.gitmodules`, so every
checkout produced four empty directories. They are now vendored as plain tracked files,
restored from the upstream sources at the exact commits the gitlinks pinned:

| Directory | Upstream | Pinned commit |
|---|---|---|
| `lsha` | [LesLivia/lsha](https://github.com/LesLivia/lsha) | `bea16c0` |
| `autotwin_automata_learning` | [AutotwinEU/autotwin_automata_learning](https://github.com/AutotwinEU/autotwin_automata_learning) | `c9c4ce3` |
| `sha2dt_semantic_mapper` | [LesLivia/sha2dt_semantic_mapper](https://github.com/LesLivia/sha2dt_semantic_mapper) | `3343a8b` |
| `skg_connector` | [LesLivia/skg_connector](https://github.com/LesLivia/skg_connector) | `4d6d13f` |

All four roots are placed on `sys.path` by `core_algorithm/tasks.py` — `lsha`'s own
modules import `skg_main` as a top-level package, so `LSHA_ROOT` alone is not enough.

---

## UPPAAL support

`verifyta` is proprietary and **cannot run inside a container** — UPPAAL 5.x's licence
check segfaults under containerisation regardless of privileges or mounts. It therefore
runs natively on the host, and the container reaches it through a small HTTP bridge in
[`uppaal-bridge/`](uppaal-bridge/).

Activate the licence once on the host, then start the bridge before running UPPAAL
case studies (THERMO, HRI):

```bash
/opt/uppaal/lib/app/bin/verifyta -k <your-licence-key>   # once
./uppaal-bridge/run-bridge.sh                            # leave running
```

See [`uppaal-bridge/README.md`](uppaal-bridge/README.md) for the full rationale,
protocol and configuration. CSV/SIM case studies (ENERGY, GREEN) don't use UPPAAL and
run with the bridge stopped.

---

## Installing Docker (Ubuntu)

```bash
sudo apt remove -y docker docker-engine docker.io containerd runc
sudo apt update
sudo apt install -y ca-certificates curl gnupg

sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

sudo usermod -aG docker $USER
newgrp docker

docker --version
docker compose version
```

---

## Services (`docker-compose.yml`)

- **redis** — Celery broker/result backend (`redis:7-alpine`).
- **backend** — Django dev server on `:8000`, built from `backend/Dockerfile`. The
  only service that runs migrations (`RUN_MIGRATIONS=1`), so the containers sharing
  the SQLite file don't contend for its write lock.
- **celery-worker** — same image as `backend`, runs `celery -A lsha_web worker -E`.
- **flower** — same image, Celery dashboard on `:5555`.
- **frontend-dev** *(profile `dev`)* — Vite dev server on `:5173` with hot reload.
- **frontend-prod** *(profile `prod`)* — Nginx serving the production build on `:80`.

Environment variables are documented in `.env.example`.
