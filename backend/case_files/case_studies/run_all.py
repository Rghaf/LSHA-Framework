"""
run_all.py — run every runnable case-study definition twice and compare.

Each definition is posted with byte-identical configuration as REP1 and REP2,
triggered, awaited, and the two learned reports are compared on alphabet,
distributions and observation-table hash.

Definitions whose inputs are absent (missing UPPAAL model, missing simulator
logs) are reported as SKIPPED rather than silently passing.

    docker compose exec backend python case_files/case_studies/run_all.py
    docker compose exec backend python case_files/case_studies/run_all.py --only GREEN_V3_REAL
    docker compose exec backend python case_files/case_studies/run_all.py --fast
"""

import argparse
import glob
import hashlib
import json
import os
import re
import sys
import time

import requests

BASE_URL = os.environ.get("LSHA_BASE_URL", "http://localhost:8000")
HERE = os.path.dirname(os.path.abspath(__file__))
BACKEND = os.path.dirname(os.path.dirname(HERE))
CASE_DIR = os.path.join(BACKEND, "case_files")
RESULTS = os.path.join(HERE, "results")
REPORT_DIR = os.path.join(BACKEND, "results", "final_results", "resources", "learned_sha")

ENERGY_DIR = os.path.join(CASE_DIR, "PowModel_Learning", "PowModel_Learning",
                          "resources", "traces", "real", "ENERGY")
ENERGY_CSVS = [os.path.join(ENERGY_DIR, f) for f in
               ("W7_2019-10-14_part0.csv", "W7_2019-10-14_part2.csv",
                "W7_2019-10-14_part3_0.csv")]
DECANTER_REAL = [os.path.join(CASE_DIR, "OldData", "20250202_DecanterData_REAL.csv")]

# stem -> (uppaal_model, uppaal_query)
UPPAAL = {
    "THERMO_V1":     ("thermostat-v1.xml", "thermostat.q"),
    "THERMO_V5":     ("thermostat-v5.xml", "thermostat.q"),
    "HRI_UPPAAL_V1": ("hri-w_ref-V1.xml",  "hri-w_ref1.q"),
    "HRI_UPPAAL_V5": ("hri-w_ref-V5.xml",  "hri-w_ref5.q"),
}
# stem -> list of CSVs
CSVS = {
    "ENERGY_V1_RANGE200":  ENERGY_CSVS,
    "ENERGY_V2_RANGE1000": ENERGY_CSVS,
    "ENERGY_V3_SIM":       ENERGY_CSVS,
    "GREEN_V3_REAL":       DECANTER_REAL,
    "GREEN_V4_CROSSING":   DECANTER_REAL,
    "GREEN_V5_CROSS_COARSE": DECANTER_REAL,
}
# Known-slow definitions, excluded by --fast
SLOW = {"ENERGY_V1_RANGE200", "ENERGY_V3_SIM"}


def why_skipped(stem, cfg):
    if stem in UPPAAL:
        m, q = UPPAAL[stem]
        missing = [f for f in (m, q) if not os.path.exists(os.path.join(CASE_DIR, f))]
        return f"missing {missing}" if missing else None
    if stem in CSVS:
        missing = [os.path.basename(p) for p in CSVS[stem] if not os.path.exists(p)]
        return f"missing {missing}" if missing else None
    if cfg["resample_strategy"] == "UPPAAL":
        return "no UPPAAL model/query available for this version"
    return "no input data mapped (simulator logs not in repo)"


def post(cfg, label, stem):
    data = {}
    for k, v in cfg.items():
        if isinstance(v, (dict, list)):
            data[k] = json.dumps(v)
        elif isinstance(v, bool):
            data[k] = "true" if v else "false"
        else:
            data[k] = str(v)
    data["name"] = label
    files, opened = {}, []
    if stem in UPPAAL:
        m, q = UPPAAL[stem]
        fh = open(os.path.join(CASE_DIR, m), "rb"); opened.append(fh)
        files["uppaal_model_file"] = (m, fh, "application/xml")
        fh = open(os.path.join(CASE_DIR, q), "rb"); opened.append(fh)
        files["uppaal_query_file"] = (q, fh, "text/plain")
    try:
        r = requests.post(f"{BASE_URL}/api/case-study/", data=data, files=files, timeout=180)
    finally:
        for fh in opened:
            fh.close()
    if r.status_code not in (200, 201):
        raise RuntimeError(f"create {r.status_code}: {r.text[:300]}")
    return r.json()["id"]


def upload(cs_id, paths):
    for p in paths:
        with open(p, "rb") as fh:
            r = requests.post(f"{BASE_URL}/api/csv-files/",
                              data={"case_study": cs_id},
                              files={"file": (os.path.basename(p), fh, "text/csv")},
                              timeout=600)
        if r.status_code not in (200, 201):
            raise RuntimeError(f"csv upload {r.status_code}: {r.text[:200]}")
    return len(paths)


def wait(label, since, timeout):
    needle = label.replace(" ", "_")
    end = time.time() + timeout
    while time.time() < end:
        if os.path.isdir(REPORT_DIR):
            for fn in os.listdir(REPORT_DIR):
                if needle in fn:
                    p = os.path.join(REPORT_DIR, fn)
                    try:
                        if os.path.getmtime(p) >= since:
                            time.sleep(2)
                            return p
                    except OSError:
                        pass
        time.sleep(5)
    return None


def parse(path):
    txt = open(path).read()

    def sec(n):
        m = re.search(rf"--{n}--\n(.*?)(?=\n\n--|\Z)", txt, re.S)
        return m.group(1).strip() if m else ""

    table = sec("FINAL OBSERVATION TABLE")
    events = dict(re.findall(r"^(\w+):\s*(.+)$", sec("OBSERVABLE EVENTS"), re.M))
    distr = dict((k, v.strip()) for k, v in
                 re.findall(r"([DN]_\d+)\(([-\d.,\s]+)\)", sec("LEARNED DISTRIBUTIONS")))
    tr = re.search(r"SAMPLED TRACES:\s*(\d+)", txt)
    rt = re.search(r"RUNNING TIME:\s*(\S+)", txt)
    used = {e for e in events if re.search(rf"(?<![\w]){re.escape(e)}(?![\d])", table)}
    return {
        "events": events, "n_events": len(events),
        "observed_events": sorted(used), "coverage": len(used) / max(len(events), 1),
        "distributions": distr, "n_distributions": len(distr),
        "table_hash": hashlib.sha256(table.encode()).hexdigest()[:16],
        "sampled_traces": int(tr.group(1)) if tr else None,
        "running_time": rt.group(1) if rt else None,
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--only")
    ap.add_argument("--fast", action="store_true", help="skip known-slow definitions")
    ap.add_argument("--reps", type=int, default=2)
    ap.add_argument("--timeout", type=int, default=1500)
    args = ap.parse_args()

    stems = {}
    for p in sorted(glob.glob(os.path.join(HERE, "*", "*.json"))):
        # skip this script's own output directory
        if os.path.basename(os.path.dirname(p)) == "results":
            continue
        stems[os.path.splitext(os.path.basename(p))[0]] = p
    if args.only:
        want = {s.strip() for s in args.only.split(",")}
        stems = {k: v for k, v in stems.items() if k in want}
    if args.fast:
        stems = {k: v for k, v in stems.items() if k not in SLOW}

    os.makedirs(RESULTS, exist_ok=True)
    log = {"runs": [], "skipped": [], "comparison": []}

    for stem, path in stems.items():
        cfg = json.load(open(path))
        reason = why_skipped(stem, cfg)
        if reason:
            log["skipped"].append({"stem": stem, "reason": reason})
            print(f"SKIP {stem:22s} {reason}")
            continue

        print(f"\n=== {stem}  (drivers={cfg['driver_signal']}) ===")
        for rep in range(1, args.reps + 1):
            label = f"{cfg['name']}-R{rep}"
            entry = {"stem": stem, "rep": rep, "label": label,
                     "drivers": cfg["driver_signal"]}
            t0 = time.time()
            try:
                cid = post(cfg, label, stem)
                entry["case_study_id"] = cid
                if stem in CSVS:
                    entry["csv"] = upload(cid, CSVS[stem])
                requests.post(f"{BASE_URL}/run/", json={"case_study_id": cid}, timeout=120)
                out = wait(label, t0, args.timeout)
                entry["wall"] = round(time.time() - t0, 1)
                if out:
                    entry["status"] = "OK"
                    entry["result"] = parse(out)
                    r = entry["result"]
                    print(f"  R{rep}: ev={r['n_events']} obs={len(r['observed_events'])} "
                          f"distr={r['n_distributions']} tr={r['sampled_traces']} "
                          f"cov={r['coverage']*100:.0f}% hash={r['table_hash']} "
                          f"({entry['wall']}s)")
                else:
                    entry["status"] = "TIMEOUT"
                    print(f"  R{rep}: TIMEOUT after {args.timeout}s")
            except Exception as exc:
                entry["status"] = "ERROR"
                entry["error"] = f"{type(exc).__name__}: {exc}"
                print(f"  R{rep}: ERROR {entry['error']}")
            log["runs"].append(entry)
            json.dump(log, open(os.path.join(RESULTS, "run_all.json"), "w"), indent=2)

        reps = [r for r in log["runs"] if r["stem"] == stem and r.get("result")]
        if len(reps) >= 2:
            a, b = reps[0]["result"], reps[1]["result"]
            c = {
                "stem": stem, "drivers": cfg["driver_signal"],
                "n_drivers": len(cfg["driver_signal"]),
                "events_match": a["events"] == b["events"],
                "table_match": a["table_hash"] == b["table_hash"],
                "distr_match": a["distributions"] == b["distributions"],
                "traces": [a["sampled_traces"], b["sampled_traces"]],
                "n_distr": [a["n_distributions"], b["n_distributions"]],
                "observed": a["observed_events"],
                "coverage": a["coverage"],
                "strategy": cfg["resample_strategy"],
            }
            c["verdict"] = ("IDENTICAL" if c["events_match"] and c["table_match"] and c["distr_match"]
                            else "STRUCTURE-ONLY" if c["events_match"] and c["table_match"]
                            else "DIVERGENT")
            log["comparison"].append(c)
            print(f"  -> {c['verdict']}")
        json.dump(log, open(os.path.join(RESULTS, "run_all.json"), "w"), indent=2)

    print("\n" + "=" * 78)
    print(f"{'case study':24s} {'drv':>3s} {'strat':6s} {'verdict':15s} {'obs/decl':9s} cov")
    print("=" * 78)
    for c in log["comparison"]:
        print(f"{c['stem']:24s} {c['n_drivers']:>3d} {c['strategy']:6s} "
              f"{c['verdict']:15s} {len(c['observed']):>3d}/{len(c['observed']) if False else ''}"
              f"{'':2s} {c['coverage']*100:4.0f}%")
    if log["skipped"]:
        print(f"\nskipped: {len(log['skipped'])}")
    print(f"\nrun_all.json -> {RESULTS}")


if __name__ == "__main__":
    main()
