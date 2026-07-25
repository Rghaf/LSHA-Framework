# Case-Study JSON Schema

How to define a case study for the L\*SHA framework without writing any Python.

A case study is a single JSON document. It is posted to `POST /api/case-study/`
(as multipart form-data when UPPAAL model/query files are attached), and the
learning run is then triggered with `POST /run/`.

The document has two layers:

- **Top level** — the `CaseStudy` database record: run parameters the *learner*
  consumes (`n_min`, `p_value`, `eq_condition`, …).
- **`user_json`** — the *domain model*: what the variables mean, which flow
  conditions exist, which events can fire, and where traces come from.

```jsonc
{
  // ── top level: learner parameters ──────────────────────────
  "name": "...", "resample_strategy": "...", "n_min": 10, ...,

  // ── user_json: the domain model ────────────────────────────
  "user_json": {
    "variables":        [ ... ],   // what the signals mean
    "models":           [ ... ],   // flow-condition families
    "events":           [ ... ],   // guards over variables
    "constants":        { ... },   // symbols usable inside guards
    "trace_generation": { ... }    // where traces come from
  }
}
```

---

## 1. Top-level fields

| Field | Type | Default | Meaning |
|---|---|---|---|
| `name` | string | — | Display name. Also used for output filenames, so avoid `/`. |
| `email` | string | `null` | Owner's address; informational. |
| `resample_strategy` | string | `"UPPAAL"` | Where traces come from. `UPPAAL` simulates a model; `CSV` / `SIM` / `STATIC` read files. All three CSV spellings normalise to `CSV`. |
| `driver_signal` | list[string] | `[]` | Signal(s) whose changes delimit trace segments. Must name **variables declared with `role: "driver"`**. |
| `main_variable` | string | `""` | The continuous variable being learned (the one whose flow condition is identified). |
| `context_variables` | list[string] | `[]` | Extra signals usable in guards but which do not by themselves cut segments. |
| `noise` | float | `0.0` | Noise tolerance passed to the learner. |
| `n_min` | int | `10` | Minimum samples a segment needs before it is used for hypothesis testing. Raise it for noisy real data; lower it if you are starving the table of observations. |
| `p_value` | float | `0.05` | Significance level for the Kolmogorov–Smirnov test in stochastic HT queries. |
| `mi_query` | bool | `false` | Enable Model-Identification queries (DDTW flow matching). Leave `false` when every model is `MEAN`. |
| `plot_ddtw` | bool | `false` | Emit DDTW diagnostic plots. |
| `ht_query` | bool | `true` | Enable Hypothesis-Testing queries (distribution identification). |
| `ht_query_type` | `"S"` \| `"D"` | `"S"` | `S` = stochastic (two-sample KS test); `D` = deterministic exact match. |
| `eq_condition` | `"S"` \| `"W"` | — | Row-equality rule. `S` (strict) compares cell-for-cell and over-approximates; `W` (weak) treats unobserved cells as wildcards and can admit non-determinism. |
| `is_aggregation` | bool | `false` | Aggregate observations across all traces rather than per-trace. Usually `true` for real CSV data, where a single trace is too short to be conclusive. |

> **`eq_condition` is case-insensitive** in the backend, but be consistent —
> `"S"` and `"s"` behave identically.

---

## 2. `user_json.variables[]`

Declares what each signal is and how it is used. Every name referenced by
`driver_signal`, `main_variable`, `context_variables`, or any guard must appear
here.

```json
{ "name": "RPM", "source": "HEADSTOCK__SPINDLE_MOTOR___1___RPM",
  "role": "driver", "type": "REAL" }
```

| Key | Meaning |
|---|---|
| `name` | The symbol used **inside guards**. Keep it short. |
| `source` | Where the value comes from: a CSV column name, or a UPPAAL variable path. When it equals `name`, no renaming happens. |
| `role` | `estimated` — the learned continuous variable (exactly one, matching `main_variable`). `driver` — segments traces. `context` — usable in guards only. |
| `type` | `REAL` or `INT`. `INT` signals whose values are strictly `{0,1}` are auto-detected as boolean, and *any* change in them is treated as a change point regardless of tolerance. |

The `source` indirection is what lets a guard say `RPM < 500` while the CSV
column is actually called `HEADSTOCK__SPINDLE_MOTOR___1___RPM`.

---

## 3. `user_json.models[]`

The flow-condition families the learner may assign to a location.

```json
{ "id": 0, "name": "Cooling Mode", "type": "EXP_DECAY" }
```

| `type` | Fits |
|---|---|
| `MEAN` | Mean value of the segment; rate 0. Use for signals with no meaningful trend (e.g. power draw within a speed band). |
| `CONSTANT` | Alias of `MEAN`. |
| `LINEAR` | Slope from consecutive increments. |
| `LINEAR_GROWTH` / `LINEAR_DECAY` | Sign-constrained linear fits. |
| `EXP_GROWTH` / `EXP_DECAY` | Exponential fits — the classic thermostat heating/cooling dynamics. |

`id` is referenced by `events[].model_id`. Ids need not be contiguous but must
be unique.

---

## 4. `user_json.events[]`

The observable alphabet. Each event is a **guard** — a boolean expression over
variable names and constants. Guards are evaluated **in declaration order** and
the **first match wins**, so order from most specific to most general.

```json
{ "symbol": "m_1", "model_id": 2, "guard": "S_LOW <= RPM and RPM < S_MID" }
```

| Key | Meaning |
|---|---|
| `symbol` | Event label in the learned automaton. Convention: a letter plus index (`h_0`, `c_1`, `m_2`). |
| `model_id` | Which entry in `models[]` governs the flow *after* this event. |
| `guard` | Boolean expression. Empty string `""` means "always true" — a catch-all. |
| `trigger_value` | Optional; used by the UPPAAL strategy to force a variable's value when generating traces. |

### Guard expression language

Evaluated in a restricted sandbox (`safe_eval`) — no imports, no attribute
access, no function calls. Available:

- **Variable names** declared in `variables[]`, plus `prev_<name>` for the
  previous sample, and `main` / `prev_main` for the estimated variable.
- **Constants** from `constants` and `trace_generation.physics_constants`.
- **Operators**: `< <= > >= == !=`, `and`, `or`, `not`, arithmetic, parentheses.

You may write `and`/`or` in English; the backend converts them to UPPAAL's
`&&`/`||` where needed. Dotted UPPAAL names such as `t.ON` are valid identifiers.

> **Failure mode to know about.** If a guard raises (typically an undefined
> constant), it is caught and skipped, and if *no* guard matches, the **first**
> event symbol is returned as a fallback. A typo in a constant name therefore
> shows up as an automaton where every transition carries the same label, not as
> a crash. The backend logs the first few occurrences — check the worker log
> before trusting a suspiciously simple result.

---

## 5. `user_json.constants{}`

Symbols usable inside guards, so thresholds are named rather than magic numbers.

```json
"constants": { "S_OFF": 500, "S_LOW": 2000, "S_MID": 5000,
               "tolerances": { "RPM": 200 } }
```

Two locations are accepted and **merged** (top-level `constants` is applied
last, so it wins on conflict):

- `user_json.constants` — preferred.
- `user_json.trace_generation.physics_constants` — legacy, still honoured.

### `tolerances`

`tolerances` is read **only** from `trace_generation.physics_constants`. It maps
a *driver* variable to the minimum change that counts as a change point:

```json
"physics_constants": { "tolerances": { "RPM": 200 } }
```

Semantics per driver:

- **boolean driver** (INT with values in `{0,1}`) — any change fires; tolerance ignored.
- **numeric driver with a tolerance** — fires when `|curr − prev| >= tol`.
- **numeric driver with no tolerance** — never fires on magnitude alone; only a
  change in the *event label* cuts a segment. This is deliberate: it stops a
  noisy signal like RPM from producing a change point on every sample.

---

## 6. `user_json.trace_generation{}`

### 6.1 UPPAAL strategy

```json
"trace_generation": {
  "strategy": "UPPAAL",
  "xml_force_variable": "force_open",
  "max_length": 15
}
```

| Key | Meaning |
|---|---|
| `strategy` | `"UPPAAL"`. |
| `xml_force_variable` | Model variable the generator rewrites to force a branch, so both sides of a choice get explored. |
| `max_length` | Cap on generated trace length. |

The model (`.xml`) and query (`.q`) are uploaded as files on the case study
(`uppaal_model_file`, `uppaal_query_file`), not named in the JSON.

**UPPAAL runs on the host, not in the container** — start
`./uppaal-bridge/run-bridge.sh` first. See `uppaal-bridge/README.md`.

### 6.2 CSV strategy

```json
"trace_generation": {
  "strategy": "CSV",
  "csv": {
    "wide_or_long":       "wide",
    "timestamp_column":   "TimestampUTC",
    "interpolate_method": "ffill",
    "derive_columns": {
      "HEADSTOCK__SPINDLE_DRIVE___1___ENERGY":
        { "factor": 60, "clip_min": 0, "target": "POWER_kW" }
    },
    "round_columns": { "HEADSTOCK__SPINDLE_MOTOR___1___RPM": 100 }
  },
  "physics_constants": { "tolerances": { "RPM": 200 } }
}
```

| Key | Meaning |
|---|---|
| `wide_or_long` | `wide` — one column per signal. `long` — tall format needing `field_column` / `value_column`. |
| `timestamp_column` | Column holding the timestamp. |
| `interpolate_method` | Gap filling for real columns: `linear`, `ffill`, … Boolean columns are always forward-filled. |
| `column_remap` | `{old: new}` renaming applied before anything else. |
| `derive_columns` | Turn a cumulative totaliser into a rate — see below. |
| `round_columns` | `{column: bucket}` — snap a column to a grid. Essential for noisy drivers. |
| `bundle_all_csv` | Treat all uploaded files as one trace group rather than one trace each. |
| `max_trace_events` | Split a long trace into chunks of at most this many events. |
| `field_column` / `value_column` | Long-format only: which columns carry the signal name and its value. |

CSV files are uploaded separately to `POST /api/csv-files/` with the case-study
id; the JSON does not list filenames.

#### `derive_columns`

Computes a **discrete derivative**, which is how a cumulative energy counter
becomes an instantaneous power signal:

```
target = clip(diff(ffill(source)) * factor, min=clip_min)
```

- `factor` — scalar multiplier (e.g. `60` converts per-second deltas to per-minute).
- `clip_min` — floor, so a counter reset does not emit a huge negative spike.
- `target` — output column; omit to overwrite the source in place.

The derived column can then be named as a variable's `source`.

---

## 7. Worked example — minimal CSV case study

```json
{
  "name": "MACHINE DEMO",
  "resample_strategy": "CSV",
  "driver_signal": ["RPM"],
  "main_variable": "POWER",
  "context_variables": [],
  "n_min": 5,
  "p_value": 0.05,
  "ht_query": true,
  "ht_query_type": "S",
  "eq_condition": "W",
  "is_aggregation": true,
  "user_json": {
    "variables": [
      { "name": "POWER", "source": "POWER_kW", "role": "estimated", "type": "REAL" },
      { "name": "RPM",   "source": "SPINDLE_RPM", "role": "driver", "type": "REAL" }
    ],
    "models": [
      { "id": 0, "name": "Idle",   "type": "MEAN" },
      { "id": 1, "name": "Cutting","type": "MEAN" }
    ],
    "events": [
      { "symbol": "i_0", "model_id": 0, "guard": "RPM < S_ON" },
      { "symbol": "r_0", "model_id": 1, "guard": "RPM >= S_ON" }
    ],
    "constants": { "S_ON": 500 },
    "trace_generation": {
      "strategy": "CSV",
      "csv": {
        "wide_or_long": "wide",
        "timestamp_column": "TimestampUTC",
        "interpolate_method": "ffill",
        "round_columns": { "SPINDLE_RPM": 100 }
      },
      "physics_constants": { "tolerances": { "RPM": 200 } }
    }
  }
}
```

---

## 8. Checklist before running

1. Exactly one variable has `role: "estimated"`, and it matches `main_variable`.
2. Every name in `driver_signal` is declared with `role: "driver"`.
3. Every identifier used in a guard is either a declared variable or a constant —
   **a typo here degrades silently** (see §4).
4. Guards are ordered specific → general; the last one may be `""` as a catch-all.
5. Every `model_id` refers to an existing `models[].id`.
6. CSV: `timestamp_column` matches the file's header exactly (they are
   case-sensitive), and any `round_columns` / `derive_columns` key is a **raw CSV
   column name**, not a variable `name`.
7. UPPAAL: the bridge is running on the host.
