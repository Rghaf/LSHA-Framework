"""
compare_legacy_vs_platform.py — run both implementations and tabulate the difference.

For each of THERMO V1 and HRI V1 it runs
  * the ORIGINAL algorithm  (run_legacy_reference.py -> upstream code only)
  * this platform           (REST API -> dynamic_sul/teacher/tracegenerator)
N times each, records every outcome including failures, and writes a
side-by-side comparison to results/comparison.json.

Ground truth is taken from the upstream sources:
    THERMO  ON_DISTR[0]  = 0.7    heating gain K
            OFF_DISTR[0] = 100.0  cooling time constant R
    HRI     N_1[0]       = 0.004  fatigue accumulation (busy)
            N_0[0]       = 0.003  fatigue recovery (idle)

    docker compose exec backend python case_files/case_studies/compare_legacy_vs_platform.py --reps 5
"""

import argparse
import json
import os
import re
import subprocess
import sys
import time

import requests

HERE = os.path.dirname(os.path.abspath(__file__))
BACKEND = os.path.dirname(os.path.dirname(HERE))
CASE_DIR = os.path.join(BACKEND, "case_files")
RESULTS = os.path.join(HERE, "results")
REPORT_DIR = os.path.join(BACKEND, "results", "final_results", "resources", "learned_sha")
BASE_URL = os.environ.get("LSHA_BASE_URL", "http://localhost:8000")

TRUTH = {
    "THERMO": {"heating (K)": 0.7, "cooling (R)": 100.0},
    "HRI": {"busy (lambda)": 0.004, "idle (mu)": 0.003},
}

PLATFORM_DEF = {
    "THERMO": os.path.join(HERE, "thermo", "THERMO_V1.json"),
    "HRI": os.path.join(HERE, "hri", "HRI_UPPAAL_V1.json"),
}
PLATFORM_UPPAAL = {
    "THERMO": ("thermostat-v1.xml", "thermostat.q"),
    "HRI": ("hri-w_ref-V1.xml", "hri-w_ref1.q"),
}


# ---------------------------------------------------------------- legacy ----
def run_legacy(case, extra=None):
    cmd = [sys.executable, os.path.join(HERE, "run_legacy_reference.py"),
           "--case", case, "--version", "1"]
    if case == "HRI":
        # The upstream HRI model trips UPPAAL 5 (duplicate INT16_MAX) and the
        # shipped query asks for 20 runs, which the upstream parser cannot split.
        cmd += ["--model", os.path.join(CASE_DIR, "hri-w_ref-V1.xml"),
                "--query", "/tmp/hri1run.q"]
    cmd += extra or []
    t0 = time.time()
    p = subprocess.run(cmd, capture_output=True, text=True, timeout=1800)
    out = os.path.join(RESULTS, "legacy", f"legacy_{case}_V1.json")
    if p.returncode == 0 and os.path.exists(out):
        d = json.load(open(out))
        return {"status": "OK", "seconds": round(time.time() - t0, 1),
                "n_traces": d["n_traces"], "symbols": d["symbols"],
                "values": sorted(round(x["params"]["avg"], 6) for x in d["distributions"]),
                "n_distributions": len(d["distributions"])}
    err = (p.stderr or p.stdout).strip().splitlines()
    return {"status": "FAILED", "seconds": round(time.time() - t0, 1),
            "error": err[-1] if err else "unknown"}


# -------------------------------------------------------------- platform ----
def run_platform(case, label):
    cfg = json.load(open(PLATFORM_DEF[case]))
    cfg["name"] = label
    data = {k: (json.dumps(v) if isinstance(v, (dict, list))
                else ("true" if v is True else "false" if v is False else str(v)))
            for k, v in cfg.items()}
    m, q = PLATFORM_UPPAAL[case]
    files, fhs = {}, []
    for key, fn, mime in (("uppaal_model_file", m, "application/xml"),
                          ("uppaal_query_file", q, "text/plain")):
        fh = open(os.path.join(CASE_DIR, fn), "rb"); fhs.append(fh)
        files[key] = (fn, fh, mime)
    t0 = time.time()
    try:
        cid = requests.post(f"{BASE_URL}/api/case-study/", data=data,
                            files=files, timeout=180).json()["id"]
    finally:
        for fh in fhs:
            fh.close()
    requests.post(f"{BASE_URL}/run/", json={"case_study_id": cid}, timeout=120)

    deadline = time.time() + 600
    while time.time() < deadline:
        if os.path.isdir(REPORT_DIR):
            for fn in os.listdir(REPORT_DIR):
                if label in fn and os.path.getmtime(os.path.join(REPORT_DIR, fn)) >= t0:
                    time.sleep(2)
                    txt = open(os.path.join(REPORT_DIR, fn)).read()
                    vals = sorted(round(float(x), 6)
                                  for x in re.findall(r"[DN]_\d+\(([-\d.]+)\)", txt))
                    tr = re.search(r"SAMPLED TRACES:\s*(\d+)", txt)
                    ev = re.findall(r"^(\w+):", re.search(
                        r"--OBSERVABLE EVENTS--\n(.*?)\n\n--", txt, re.S).group(1), re.M)
                    return {"status": "OK", "seconds": round(time.time() - t0, 1),
                            "n_traces": int(tr.group(1)) if tr else None,
                            "symbols": ev, "values": vals,
                            "n_distributions": len(vals)}
        time.sleep(4)
    return {"status": "TIMEOUT", "seconds": round(time.time() - t0, 1)}


def closest(vals, target):
    """Best relative error of any learned value against a known parameter."""
    if not vals:
        return None
    best = min(vals, key=lambda v: abs(v - target))
    return {"nearest": best, "rel_error_pct": round(abs(best - target) / abs(target) * 100, 2)}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--reps", type=int, default=5)
    ap.add_argument("--cases", default="THERMO,HRI")
    args = ap.parse_args()

    os.makedirs(os.path.join(RESULTS, "legacy"), exist_ok=True)
    report = {"truth": TRUTH, "runs": {}, "summary": {}}

    for case in [c.strip() for c in args.cases.split(",")]:
        report["runs"][case] = {"legacy": [], "platform": []}

        print(f"\n{'='*70}\n  {case}  —  ORIGINAL ALGORITHM\n{'='*70}")
        for i in range(1, args.reps + 1):
            r = run_legacy(case)
            report["runs"][case]["legacy"].append(r)
            if r["status"] == "OK":
                print(f"  run {i}: traces={r['n_traces']:>3} distr={r['n_distributions']} "
                      f"values={r['values']}")
            else:
                print(f"  run {i}: {r['status']} — {r.get('error','')[:90]}")

        print(f"\n{'='*70}\n  {case}  —  THIS PLATFORM\n{'='*70}")
        for i in range(1, args.reps + 1):
            r = run_platform(case, f"CMP-{case}-R{i}")
            report["runs"][case]["platform"].append(r)
            if r["status"] == "OK":
                print(f"  run {i}: traces={r['n_traces']:>3} distr={r['n_distributions']} "
                      f"values={r['values'][:8]}")
            else:
                print(f"  run {i}: {r['status']}")

        # summarise accuracy against ground truth
        summ = {}
        for impl in ("legacy", "platform"):
            ok = [r for r in report["runs"][case][impl] if r["status"] == "OK"]
            allv = sorted({v for r in ok for v in r["values"]})
            summ[impl] = {
                "runs": len(report["runs"][case][impl]),
                "succeeded": len(ok),
                "all_values": allv,
                "accuracy": {k: closest(allv, t) for k, t in TRUTH[case].items()},
            }
        report["summary"][case] = summ

    with open(os.path.join(RESULTS, "comparison.json"), "w") as fh:
        json.dump(report, fh, indent=2)

    print(f"\n\n{'='*70}\n  ACCURACY vs GROUND TRUTH\n{'='*70}")
    for case, summ in report["summary"].items():
        print(f"\n{case}")
        for param, truth in TRUTH[case].items():
            print(f"  {param}  (true = {truth})")
            for impl in ("legacy", "platform"):
                a = summ[impl]["accuracy"][param]
                if a:
                    print(f"     {impl:9s} nearest={a['nearest']:<14} "
                          f"err={a['rel_error_pct']}%")
                else:
                    print(f"     {impl:9s} no successful run")
        for impl in ("legacy", "platform"):
            s = summ[impl]
            print(f"  {impl:9s} succeeded {s['succeeded']}/{s['runs']}")
    print(f"\ncomparison.json -> {RESULTS}")


if __name__ == "__main__":
    main()
