#!/usr/bin/env python3
"""
UPPAAL bridge — runs on the HOST, outside Docker.

UPPAAL 5.x's licence check segfaults inside a container (it dereferences NULL
when its hardware-fingerprinting probes come up empty, which they always do
under containerisation — reproduced even with --privileged and full /dev + /sys
mounted). So verifyta stays native on the host, and the Dockerised Celery
worker reaches it through this small HTTP service.

The container-side counterpart is ./verifyta, a shim installed at
/opt/uppaal/lib/app/bin/verifyta inside the image; it speaks this protocol and
is invoked by dynamic_tracegenerator.py exactly as the real binary would be.

Protocol
    POST /verify
      headers: X-Auth-Token: <shared token>
      body:    {"model": "<xml>", "query": "<q>", "args": ["-t0"]}
      returns: {"stdout": "...", "stderr": "...", "returncode": 0}

    GET /health -> {"status": "ok", "verifyta": "<path>"}

Only the verifyta binary is ever executed, and only with the flags in `args`
(validated against an allow-list) — the request cannot name a different
program or inject shell syntax.

Run it with:
    ./uppaal-bridge/run-bridge.sh
"""

import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

VERIFYTA = os.environ.get("UPPAAL_BIN", "/opt/uppaal/lib/app/bin/verifyta")
BIND = os.environ.get("UPPAAL_BRIDGE_BIND", "0.0.0.0")
PORT = int(os.environ.get("UPPAAL_BRIDGE_PORT", "8899"))
TOKEN = os.environ.get("UPPAAL_BRIDGE_TOKEN", "")
TIMEOUT = int(os.environ.get("UPPAAL_BRIDGE_TIMEOUT", "600"))
MAX_BODY = 64 * 1024 * 1024

# verifyta flags the callers are allowed to pass through. -t<n> selects the
# trace type (dynamic_tracegenerator) and -r seeds the RNG (the legacy
# resources/scripts/verify.sh). A bare integer is accepted so `-r <seed>` can
# carry its value; the rest are harmless verification-mode switches kept so the
# shim stays a drop-in.
ALLOWED_FLAG = re.compile(r"^(-(t\d|r|s|q|u|A|S\d|E\d|C|H\d+|W|Y)|\d+)$")


def _run_verifyta(model_text, query_text, args):
    workdir = tempfile.mkdtemp(prefix="uppaal-bridge-")
    try:
        model_path = os.path.join(workdir, "model.xml")
        query_path = os.path.join(workdir, "query.q")
        with open(model_path, "w") as fh:
            fh.write(model_text)
        with open(query_path, "w") as fh:
            fh.write(query_text)

        cmd = [VERIFYTA] + args + [model_path, query_path]
        proc = subprocess.run(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            timeout=TIMEOUT,
            cwd=workdir,
        )
        return proc.stdout, proc.stderr, proc.returncode
    finally:
        shutil.rmtree(workdir, ignore_errors=True)


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def _reply(self, code, payload):
        body = json.dumps(payload).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path == "/health":
            self._reply(200, {"status": "ok", "verifyta": VERIFYTA,
                              "exists": os.path.exists(VERIFYTA)})
        else:
            self._reply(404, {"error": "not found"})

    def do_POST(self):
        if self.path != "/verify":
            self._reply(404, {"error": "not found"})
            return

        if TOKEN and self.headers.get("X-Auth-Token", "") != TOKEN:
            self._reply(403, {"error": "bad or missing X-Auth-Token"})
            return

        length = int(self.headers.get("Content-Length", "0"))
        if length <= 0 or length > MAX_BODY:
            self._reply(413, {"error": "missing or oversized body"})
            return

        try:
            req = json.loads(self.rfile.read(length))
        except json.JSONDecodeError as exc:
            self._reply(400, {"error": f"invalid JSON: {exc}"})
            return

        model_text = req.get("model")
        query_text = req.get("query")
        if not isinstance(model_text, str) or not isinstance(query_text, str):
            self._reply(400, {"error": "'model' and 'query' must be strings"})
            return

        args = req.get("args", [])
        if not isinstance(args, list) or not all(isinstance(a, str) for a in args):
            self._reply(400, {"error": "'args' must be a list of strings"})
            return
        bad = [a for a in args if not ALLOWED_FLAG.match(a)]
        if bad:
            self._reply(400, {"error": f"disallowed verifyta flags: {bad}"})
            return

        try:
            stdout, stderr, rc = _run_verifyta(model_text, query_text, args)
        except subprocess.TimeoutExpired:
            self._reply(504, {"error": f"verifyta exceeded {TIMEOUT}s"})
            return
        except Exception as exc:  # noqa: BLE001 - surface anything to the caller
            self._reply(500, {"error": f"{type(exc).__name__}: {exc}"})
            return

        self._reply(200, {"stdout": stdout, "stderr": stderr, "returncode": rc})

    def log_message(self, fmt, *fmt_args):
        sys.stderr.write("[uppaal-bridge] %s\n" % (fmt % fmt_args))


def main():
    if not os.path.exists(VERIFYTA):
        sys.exit(f"verifyta not found at {VERIFYTA} — set UPPAAL_BIN")

    probe = subprocess.run([VERIFYTA, "--version"], capture_output=True, text=True)
    if probe.returncode != 0:
        sys.exit(
            f"verifyta at {VERIFYTA} failed --version (exit {probe.returncode}).\n"
            f"{probe.stderr.strip()}\n"
            "If this says the licence does not cover the verifier, activate it "
            "first:  verifyta -k <your-key>"
        )
    print(f"[uppaal-bridge] {probe.stdout.strip().splitlines()[0]}")
    if not TOKEN:
        print("[uppaal-bridge] WARNING: UPPAAL_BRIDGE_TOKEN is empty — auth disabled")
    print(f"[uppaal-bridge] listening on {BIND}:{PORT}, exec {VERIFYTA}")

    ThreadingHTTPServer((BIND, PORT), Handler).serve_forever()


if __name__ == "__main__":
    main()
