"""
run_test_suite.py — reproducibility harness for the L*SHA framework.

Posts each case study in this directory twice (REP1, REP2) with byte-identical
configuration, triggers the learning task, waits for completion, and records
where the two replicas agree.

Run from inside the backend container, with the stack up and (for the UPPAAL
case studies) the host-side bridge running:

    docker compose exec backend python case_files/test_suite/run_test_suite.py
    docker compose exec backend python case_files/test_suite/run_test_suite.py --only TS_ENERGY_A

Results are written to case_files/test_suite/results/run_log.json.
"""

import argparse
import glob
import hashlib
import json
import os
import re
import shutil
import sys
import time

import requests

BASE_URL = os.environ.get("LSHA_BASE_URL", "http://localhost:8000")
HERE = os.path.dirname(os.path.abspath(__file__))
BACKEND = os.path.dirname(os.path.dirname(HERE))
RESULTS_DIR = os.path.join(HERE, "results")

ENERGY_DIR = os.path.join(
    BACKEND, "case_files", "PowModel_Learning", "PowModel_Learning",
    "resources", "traces", "real", "ENERGY",
)
CASE_DIR = os.path.join(BACKEND, "case_files")

# Same three CNC segments for both ENERGY variants, so the only difference
# between them is the discretisation defined in their JSON.
ENERGY_CSVS = [
    os.path.join(ENERGY_DIR, "W7_2019-10-14_part0.csv"),
    os.path.join(ENERGY_DIR, "W7_2019-10-14_part2.csv"),
    os.path.join(ENERGY_DIR, "W7_2019-10-14_part3_0.csv"),
]

UPPAAL_FILES = {
    "TS_THERMO_V1": (os.path.join(CASE_DIR, "thermostat-v1.xml"),
                     os.path.join(CASE_DIR, "thermostat.q")),
    "TS_THERMO_V5": (os.path.join(CASE_DIR, "thermostat-v5.xml"),
                     os.path.join(CASE_DIR, "thermostat.q")),
}

CSV_FILES = {
    "TS_ENERGY_V1": ENERGY_CSVS,
    "TS_ENERGY_V2": ENERGY_CSVS,
}


def post_case_study(cfg, label, uppaal=None):
    """Create one CaseStudy row; returns its id."""
    data = {}
    for k, v in cfg.items():
        if k in ("uppaal_model_file", "uppaal_query_file"):
            continue
        if isinstance(v, (dict, list)):
            data[k] = json.dumps(v)
        elif isinstance(v, bool):
            data[k] = "true" if v else "false"
        else:
            data[k] = str(v)
    data["name"] = label

    files = {}
    opened = []
    if uppaal:
        model, query = uppaal
        if os.path.exists(model):
            fh = open(model, "rb"); opened.append(fh)
            files["uppaal_model_file"] = (os.path.basename(model), fh, "application/xml")
        if os.path.exists(query):
            fh = open(query, "rb"); opened.append(fh)
            files["uppaal_query_file"] = (os.path.basename(query), fh, "text/plain")

    try:
        r = requests.post(f"{BASE_URL}/api/case-study/", data=data, files=files, timeout=120)
    finally:
        for fh in opened:
            fh.close()

    if r.status_code not in (200, 201):
        raise RuntimeError(f"create failed {r.status_code}: {r.text[:400]}")
    return r.json()["id"]


def upload_csvs(cs_id, paths):
    n = 0
    for p in paths:
        if not os.path.exists(p):
            print(f"    WARNING: missing CSV {p}")
            continue
        with open(p, "rb") as fh:
            r = requests.post(
                f"{BASE_URL}/api/csv-files/",
                data={"case_study": cs_id},
                files={"file": (os.path.basename(p), fh, "text/csv")},
                timeout=300,
            )
        if r.status_code not in (200, 201):
            raise RuntimeError(f"csv upload failed {r.status_code}: {r.text[:300]}")
        n += 1
    return n


def trigger(cs_id):
    r = requests.post(f"{BASE_URL}/run/", json={"case_study_id": cs_id}, timeout=120)
    if r.status_code not in (200, 201, 202):
        raise RuntimeError(f"trigger failed {r.status_code}: {r.text[:300]}")
    try:
        return r.json().get("task_id")
    except Exception:
        return None


def wait_for_output(label, since, timeout=1800, poll=5):
    """Poll for the report the task writes at the end of a successful run.

    Keyed on modification time, not on the filename being new: re-running the
    same case study rewrites the same path, so a "did a new file appear" check
    silently times out on every run after the first.
    """
    report = os.path.join(
        BACKEND, "results", "final_results", "resources", "learned_sha",
    )
    needle = label.replace(" ", "_")
    deadline = time.time() + timeout
    while time.time() < deadline:
        if os.path.isdir(report):
            for fn in os.listdir(report):
                if needle not in fn:
                    continue
                path = os.path.join(report, fn)
                try:
                    if os.path.getmtime(path) >= since:
                        time.sleep(2)      # let the writer finish
                        return path
                except OSError:
                    pass
        time.sleep(poll)
    return None


def parse_report(path):
    """Extract the comparable facts from a learned-SHA report."""
    with open(path) as fh:
        text = fh.read()

    def section(name):
        m = re.search(rf"--{name}--\n(.*?)(?=\n\n--|\Z)", text, re.S)
        return m.group(1).strip() if m else ""

    distributions = re.findall(r"([DN]_\d+)\(([-\d.,\s]+)\)", section("LEARNED DISTRIBUTIONS"))
    table = section("FINAL OBSERVATION TABLE")
    traces = re.search(r"SAMPLED TRACES:\s*(\d+)", text)
    runtime = re.search(r"RUNNING TIME:\s*(\S+)", text)
    events = dict(re.findall(r"^(\w+):\s*(.+)$", section("OBSERVABLE EVENTS"), re.M))

    return {
        "report_file": os.path.basename(path),
        "events": events,
        "n_events": len(events),
        "distributions": {k: v.strip() for k, v in distributions},
        "n_distributions": len(distributions),
        "obs_table": table,
        "obs_table_hash": hashlib.sha256(table.encode()).hexdigest()[:16],
        "table_rows": len([l for l in table.splitlines()
                           if l.strip() and not l.startswith(("-", " "))
                           and "|" in l]),
        "sampled_traces": int(traces.group(1)) if traces else None,
        "running_time": runtime.group(1) if runtime else None,
    }


def api_state(cs_id):
    try:
        r = requests.get(f"{BASE_URL}/api/case-study/{cs_id}/", timeout=60)
        d = r.json()
        return {"final_result_pdf": d.get("final_result_pdf"),
                "final_result_txt": d.get("final_result_txt")}
    except Exception as exc:
        return {"error": str(exc)}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", help="comma-separated stems, e.g. TS_ENERGY_A")
    ap.add_argument("--reps", type=int, default=2)
    ap.add_argument("--timeout", type=int, default=1800)
    args = ap.parse_args()

    stems = sorted(
        os.path.splitext(os.path.basename(p))[0]
        for p in glob.glob(os.path.join(HERE, "TS_*.json"))
    )
    if args.only:
        wanted = {s.strip() for s in args.only.split(",")}
        stems = [s for s in stems if s in wanted]
    if not stems:
        sys.exit("no case studies matched")

    os.makedirs(RESULTS_DIR, exist_ok=True)
    log = {"base_url": BASE_URL, "reps": args.reps, "runs": []}

    for stem in stems:
        with open(os.path.join(HERE, f"{stem}.json")) as fh:
            cfg = json.load(fh)

        for rep in range(1, args.reps + 1):
            label = f"{cfg['name']}-REP{rep}"
            print(f"\n=== {label} ===")
            entry = {"stem": stem, "rep": rep, "label": label}
            started = time.time()
            try:
                cs_id = post_case_study(cfg, label, UPPAAL_FILES.get(stem))
                entry["case_study_id"] = cs_id
                print(f"  created id={cs_id}")

                if stem in CSV_FILES:
                    n = upload_csvs(cs_id, CSV_FILES[stem])
                    entry["csv_uploaded"] = n
                    print(f"  uploaded {n} CSV(s)")

                entry["task_id"] = trigger(cs_id)
                print(f"  triggered task={entry['task_id']}")

                out = wait_for_output(label, since=started, timeout=args.timeout)
                entry["wall_seconds"] = round(time.time() - started, 1)
                if out:
                    entry["status"] = "COMPLETED"
                    entry["result"] = parse_report(out)
                    print(f"  OK  events={entry['result']['n_events']} "
                          f"distr={entry['result']['n_distributions']} "
                          f"traces={entry['result']['sampled_traces']} "
                          f"table={entry['result']['obs_table_hash']}")
                else:
                    entry["status"] = "NO_OUTPUT"
                    print("  FAILED: no report produced within timeout")
                entry["api"] = api_state(cs_id)
            except Exception as exc:
                entry["status"] = "ERROR"
                entry["error"] = f"{type(exc).__name__}: {exc}"
                print(f"  ERROR: {entry['error']}")

            log["runs"].append(entry)
            with open(os.path.join(RESULTS_DIR, "run_log.json"), "w") as fh:
                json.dump(log, fh, indent=2)

    # ---- reproducibility comparison -------------------------------------
    print("\n" + "=" * 62)
    print("  REPRODUCIBILITY")
    print("=" * 62)
    log["comparison"] = []
    for stem in stems:
        reps = [r for r in log["runs"] if r["stem"] == stem and r.get("result")]
        cmp_entry = {"stem": stem, "completed_reps": len(reps)}
        if len(reps) >= 2:
            a, b = reps[0]["result"], reps[1]["result"]
            cmp_entry.update({
                "events_match":        a["events"] == b["events"],
                "distributions_match": a["distributions"] == b["distributions"],
                "obs_table_match":     a["obs_table_hash"] == b["obs_table_hash"],
                "traces_match":        a["sampled_traces"] == b["sampled_traces"],
                "a_hash": a["obs_table_hash"], "b_hash": b["obs_table_hash"],
                "a_distr": a["distributions"], "b_distr": b["distributions"],
                "a_traces": a["sampled_traces"], "b_traces": b["sampled_traces"],
            })
            verdict = ("IDENTICAL" if all([cmp_entry["events_match"],
                                           cmp_entry["distributions_match"],
                                           cmp_entry["obs_table_match"]])
                       else "STRUCTURE-ONLY" if cmp_entry["obs_table_match"]
                       else "DIVERGENT")
            cmp_entry["verdict"] = verdict
            print(f"  {stem:16s} {verdict:15s} "
                  f"events={cmp_entry['events_match']} "
                  f"table={cmp_entry['obs_table_match']} "
                  f"distr={cmp_entry['distributions_match']}")
        else:
            cmp_entry["verdict"] = "INCOMPLETE"
            print(f"  {stem:16s} INCOMPLETE ({len(reps)}/2 runs produced output)")
        log["comparison"].append(cmp_entry)

    with open(os.path.join(RESULTS_DIR, "run_log.json"), "w") as fh:
        json.dump(log, fh, indent=2)
    print(f"\nrun_log.json written to {RESULTS_DIR}")


if __name__ == "__main__":
    main()
