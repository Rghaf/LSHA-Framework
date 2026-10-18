"""
sync.py — assemble docs/case-studies/ from the generated definitions.

Lays out one directory per case-study version, each holding the JSON the
platform consumes plus the UPPAAL model/query it needs:

    docs/case-studies/thermo/v1/
        THERMO_V1.json
        thermostat-v1.xml
        thermostat.q
        README.md

Definitions come from backend/case_files/case_studies/ (produced by
generate_all.py) and the UPPAAL files from backend/case_files/. Re-run this
after regenerating the definitions:

    python docs/case-studies/sync.py

CSV inputs are deliberately NOT copied. The ENERGY and GREEN datasets are
large (~139 MB for PowModel_Learning) and are git-ignored; each affected
README names the exact files and where they live instead.
"""

import json
import os
import shutil

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
DEFS = os.path.join(ROOT, "backend", "case_files", "case_studies")
CASE_FILES = os.path.join(ROOT, "backend", "case_files")

ENERGY_CSVS = [
    "case_files/PowModel_Learning/PowModel_Learning/resources/traces/real/"
    "ENERGY/W7_2019-10-14_part0.csv",
    "case_files/PowModel_Learning/PowModel_Learning/resources/traces/real/"
    "ENERGY/W7_2019-10-14_part2.csv",
    "case_files/PowModel_Learning/PowModel_Learning/resources/traces/real/"
    "ENERGY/W7_2019-10-14_part3_0.csv",
]
DECANTER_CSV = ["case_files/OldData/20250202_DecanterData_REAL.csv"]

NO_THERMO_MODEL = (
    "No UPPAAL model for this version is present in the repository, so the "
    "definition cannot be run as-is. Supply a `thermostat-v{}.xml` built for "
    "this alphabet to use it.")
NO_HRI_MODEL = (
    "No UPPAAL model/query for this version is present in the repository, so "
    "the definition cannot be run as-is.")
HRI_SIM_NOTE = (
    "Simulator-driven variant. Needs `humanFatigue.log` / `humanPosition.log` "
    "converted to a wide CSV with a pre-computed `moving` column; those logs "
    "are not in the repository.")

# (family, version dir, definition file, [uppaal files], [csv inputs], note)
LAYOUT = [
    # ---- THERMO -----------------------------------------------------------
    ("thermo", f"v{v}", f"thermo/THERMO_V{v}.json",
     ["thermostat-v1.xml", "thermostat.q"] if v == 1 else
     ["thermostat-v5.xml", "thermostat.q"] if v == 5 else [],
     [],
     "" if v in (1, 5) else NO_THERMO_MODEL.format(v))
    for v in range(1, 11)
] + [
    # ---- HRI --------------------------------------------------------------
    ("hri", f"uppaal-v{v}", f"hri/HRI_UPPAAL_V{v}.json",
     ["hri-w_ref-V1.xml", "hri-w_ref1.q"] if v == 1 else
     ["hri-w_ref-V5.xml", "hri-w_ref5.q"] if v == 5 else [],
     [],
     "" if v in (1, 5) else NO_HRI_MODEL)
    for v in range(1, 6)
] + [
    ("hri", f"sim-v{v}", f"hri/HRI_SIM_V{v}.json", [], [], HRI_SIM_NOTE)
    for v in (1, 2, 3)
] + [
    # ---- ENERGY -----------------------------------------------------------
    ("energy", "v1-range200",  "energy/ENERGY_V1_RANGE200.json",  [], ENERGY_CSVS,
     "Shipped `[ENERGY CS]` granularity (SPEED_RANGE = 200) -> 53 events. "
     "Slow: most bands never fire on this data."),
    ("energy", "v2-range1000", "energy/ENERGY_V2_RANGE1000.json", [], ENERGY_CSVS,
     "Coarser granularity (SPEED_RANGE = 1000) -> 13 events. Same information "
     "as v1 on this dataset, far faster."),
    ("energy", "v3-sim",       "energy/ENERGY_V3_SIM.json",       [], ENERGY_CSVS,
     "Reproduces `energy_sim`, which compares pressure for exact change rather "
     "than against PR_RANGE. Indistinguishable from v1 unless the pressure "
     "column is populated."),
    # ---- GREEN ------------------------------------------------------------
    ("green", "v1", "green/GREEN_V1.json", [], [],
     "Canonical gr3n definition (drivers `SpeedSP` / `Value`). The decanter "
     "exports in this repository do not contain those fields, so use v3-real "
     "to actually run it."),
    ("green", "v2-coarse", "green/GREEN_V2_COARSE.json", [], [],
     "As v1 with wider bands (10 / 5) -> 10 events. Same data caveat as v1."),
    ("green", "v3-real", "green/GREEN_V3_REAL.json", [], DECANTER_CSV,
     "gr3n structure re-targeted onto signals the available exports really "
     "contain (`Assorbimento`, `TCuscinettiRiduttore`). This is the runnable "
     "GREEN configuration."),
    ("green", "v4-crossing", "green/GREEN_V4_CROSSING.json", [], DECANTER_CSV,
     "As v3-real but with band-crossing guards, so the second driver's events "
     "become reachable. Larger alphabet; may not converge quickly."),
    ("green", "v5-cross-coarse", "green/GREEN_V5_CROSS_COARSE.json", [], DECANTER_CSV,
     "Coarse crossing variant (2 bands per driver) that does converge."),
]

README = """# {title}

{note_block}## Files

{files}

## Configuration summary

| Field | Value |
|---|---|
| strategy | `{strategy}` |
| drivers | {drivers} |
| estimated variable | `{main}` |
| events | {n_events} |
| flow conditions | {n_models} |
| `mi_query` | `{mi}` |
| `default_model_id` | `{dmi}` |
| `ht_sample_mode` | `{hsm}` |
{seed_row}
## Running it

{run_intro}

Submit the definition — `POST /api/case-study/` with these JSON fields{attach}
— then trigger `POST /run/`. The bundled harness does all of that:

```bash
docker compose exec backend python case_files/case_studies/run_all.py --only {stem}
```
"""

RUN_UPPAAL = """`verifyta` segfaults inside a container, so the host-side bridge has to be
running alongside the stack:

```bash
docker compose up -d
./uppaal-bridge/run-bridge.sh
```"""

RUN_CSV = """```bash
docker compose up -d
```"""

ATTACH_UPPAAL = (", attaching the `.xml` and `.q` above as `uppaal_model_file`\n"
                 "and `uppaal_query_file`")
ATTACH_CSV = (", then upload the input CSVs to\n"
              "`POST /api/csv-files/` with `case_study=<id>`")


INDEX = """# Case studies

Every case-study definition the platform ships with, one directory per version,
each holding the JSON the platform consumes plus the UPPAAL model and query it
needs. Regenerate with `python docs/case-studies/sync.py` after re-running
`backend/case_files/case_studies/generate_all.py`.

The four families come from the reference L\\*SHA implementation
(`backend/core_algorithm/lsha/sha_learning/case_studies/`); the versions within
each family are the `CS_VERSION` variants that implementation's `sul_functions.py`
branches on, expressed as platform JSON rather than as Python.

- **THERMO** — the thermostat: a room temperature driven by a heater switching
  on and off. Two flow conditions (heating, cooling), traces generated by UPPAAL SMC.
- **HRI** — human-robot interaction: operator fatigue during a collaborative
  task. The case study L\\*SHA was originally built for, hence its stochastic
  flow parameters. Available in UPPAAL and simulator-log variants.
- **ENERGY** — a real CNC machine: spindle power as a function of speed and
  pressure, learned from logged production data.
- **GREEN** — a gr3n decanter centrifuge: absorption against bearing temperature,
  also from logged data.

## Index

| Case study | Strategy | Drivers | Estimated | Events | Runnable here |
|---|---|---|---|---|---|
{rows}

"Runnable here" means the inputs it needs are present in this repository. The
rest are included for completeness — each one's README says what is missing.

## What is in a definition

The JSON is exactly what `POST /api/case-study/` accepts, so these files double
as worked examples of the request format. The fields that matter most:

| Field | Meaning |
|---|---|
| `driver_signal` | the boolean/derived signals whose changes generate events |
| `main_variable` | the continuous variable whose flow and distribution are learned |
| `events` | the alphabet: a guard/channel pair per symbol, plus the `trigger_value` written into the UPPAAL force array to steer trace generation toward a word |
| `models` | the candidate flow conditions, in the order the SUL indexes them |
| `mi_query` | when false, every segment uses `default_model_id` instead of being identified by DTW |
| `default_model_id` | which flow condition that fallback picks (THERMO is the only family where this is not `0`) |
| `ht_sample_mode` | `raw` feeds the hypothesis test one metric per trace, `replicated` repeats the segment metrics — matches the reference's `if CS == 'THERMO'` branch |
| `trace_generation.seed` | seeds `verifyta -r`, making UPPAAL runs reproducible |
"""


def main():
    made = 0
    rows = []
    for family, vdir, defrel, uppaal, csvs, note in LAYOUT:
        src = os.path.join(DEFS, defrel)
        if not os.path.exists(src):
            print(f"  SKIP {defrel} (missing)")
            continue

        dest = os.path.join(HERE, family, vdir)
        os.makedirs(dest, exist_ok=True)
        shutil.copy2(src, dest)

        files = [f"- `{os.path.basename(src)}` — the case-study definition"]
        for u in uppaal:
            usrc = os.path.join(CASE_FILES, u)
            if os.path.exists(usrc):
                shutil.copy2(usrc, dest)
                kind = "UPPAAL model" if u.endswith(".xml") else "UPPAAL query"
                files.append(f"- `{u}` — {kind}")
            else:
                print(f"  WARN {u} not found for {family}/{vdir}")
        for c in csvs:
            files.append(f"- `{c}` — input data (not copied: large / git-ignored)")

        cfg = json.load(open(src))
        uj = cfg["user_json"]
        seed = uj.get("trace_generation", {}).get("seed")
        is_upp = cfg["resample_strategy"] == "UPPAAL"

        if is_upp:
            seed_row = (f"| trace seed | `{seed}` — verifyta is given `-r {seed}`, "
                        "so repeated runs sample identical traces |\n"
                        if seed is not None else
                        "| trace seed | not set — verifyta reseeds itself, so "
                        "each run samples different traces |\n")
        else:
            seed_row = ("| trace seed | n/a — traces are read from the CSVs, "
                        "so runs are already reproducible |\n")

        with open(os.path.join(dest, "README.md"), "w") as fh:
            fh.write(README.format(
                title=cfg["name"],
                note_block=(note + "\n\n") if note else "",
                files="\n".join(files),
                strategy=cfg["resample_strategy"],
                drivers=", ".join(f"`{d}`" for d in cfg["driver_signal"]),
                main=cfg["main_variable"],
                n_events=len(uj["events"]),
                n_models=len(uj["models"]),
                mi=str(cfg.get("mi_query")).lower(),
                dmi=cfg.get("default_model_id", 0),
                hsm=cfg.get("ht_sample_mode", "replicated"),
                seed_row=seed_row,
                run_intro=RUN_UPPAAL if is_upp else RUN_CSV,
                attach=(ATTACH_UPPAAL if uppaal else
                        (ATTACH_CSV if csvs else "")),
                stem=os.path.splitext(os.path.basename(src))[0],
            ))
        made += 1
        # Runnable = the inputs it needs are actually present. UPPAAL versions
        # need a model+query; CSV versions need mapped data files.
        runnable = "yes" if (uppaal if is_upp else csvs) else "no"
        rows.append(
            f"| [{cfg['name']}]({family}/{vdir}/) | `{cfg['resample_strategy']}` | "
            f"{', '.join('`%s`' % d for d in cfg['driver_signal'])} | "
            f"`{cfg['main_variable']}` | {len(uj['events'])} | {runnable} |")
        print(f"  {family}/{vdir:16s} {os.path.basename(src)}"
              f"{' + ' + ', '.join(uppaal) if uppaal else ''}")

    with open(os.path.join(HERE, "README.md"), "w") as fh:
        fh.write(INDEX.format(rows="\n".join(rows)))
    print(f"\n{made} case-study directories written under docs/case-studies/")


if __name__ == "__main__":
    main()
