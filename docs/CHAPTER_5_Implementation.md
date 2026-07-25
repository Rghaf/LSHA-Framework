# 5 | Implementation of the Universal Learning Engine

This chapter documents how the L\*-SHA active-learning algorithm — originally a
research artefact that had to be re-coded by hand for every new system — was
re-engineered into a **universal, configuration-driven learning engine**. The
engine executes the *same* `Learner` / `Teacher` / `ObsTable` core for every
case study, and everything that distinguishes one physical system from another
is now supplied by the user as data (a JSON document plus a set of trace files),
never as code. A domain expert can therefore define a brand-new case study from
a web browser and obtain a learned Stochastic Hybrid Automaton (SHA) without
writing, editing, or redeploying a single line of Python.

The chapter proceeds from the outside in. Section 5.1 states the architectural
problem and the full-stack response to it. Section 5.2 specifies the
configuration contract that the user fills in. Sections 5.3 through 5.6 then
walk through each runtime component — the System Under Learning, the Trace
Generator, the Teacher, and the algorithmic bookkeeping — explaining both what
each component does and which hard-coded assumption it replaced.

---

## 5.1 From Hard-Coded Scripts to a Configurable Architecture

### 5.1.1 The Legacy Approach and Systemic Drawbacks

The reference implementation of L\*-SHA organised all system-specific code as a
family of per-case-study Python packages:

```
core_algorithm/lsha/sha_learning/case_studies/
├── thermostat/   sul_functions.py + sul_definition.py
├── hri/          sul_functions.py + sul_definition.py
├── energy/       sul_functions.py + sul_definition.py
├── energy_sim/   sul_functions.py + sul_definition.py
├── gr3n/         sul_functions.py + sul_definition.py
└── auto_twin/    sul_functions.py + sul_definition.py
```

Each `sul_functions.py` exported four polymorphic hooks that the learning core
called by name — `parse_data`, `is_chg_pt`, `label_event`, and a
`get_<x>_param` flow-fitting function. The bodies of these hooks hard-coded
everything about the experiment: the column layout of the trace file, the
positional indices of each signal, the threshold constants, the guard logic
expressed as `if/elif` chains keyed on a `CS_VERSION` number, and the physics
formula used to fit each segment. A representative example from the energy case
study reads three constants straight out of `config.ini` and then addresses
signals by fixed integer position:

```python
# energy_sim/sul_functions.py  (legacy)
SPEED_RANGE = int(config['ENERGY CS']['SPEED_RANGE'])   # 200
MIN_SPEED   = int(config['ENERGY CS']['MIN_SPEED'])     # 100
MAX_SPEED   = int(config['ENERGY CS']['MAX_SPEED'])     # 10000

def is_chg_pt(curr, prev):
    # 'curr' is a 2-tuple: (speed_value, pressure_value)
    return abs(curr[0] - prev[0]) > SPEED_RANGE or curr[1] != prev[1]

def parse_data(path):
    # reads CSV columns by FIXED position: row[2]=time, row[3]=speed …
    ...
```

Selection between case studies was itself a global constant
(`CS = config['SUL CONFIGURATION']['CASE_STUDY']`) read once at module import
time. This organisation produced three concrete, systemic drawbacks.

**(1) Code duplication.** Five of the six case studies shared a nearly identical
CSV-loading skeleton that differed only in column names and tolerance constants.
A defect fixed in one copy had to be back-ported by hand to the others, and
divergence between the copies accumulated over time.

**(2) Tight coupling between data format and analysis.** Because the trace
parser lived *inside* each case-study module, a change to the UPPAAL
pretty-printer format forced an edit to every module — including the CSV-only
ones that never touch UPPAAL. Structural concerns (how to read a file) and
semantic concerns (what the signals mean) could not be separated.

**(3) No path to web-driven configurability.** Adding a new system required a
developer to (a) write a new `sul_functions.py`, (b) rebuild and redeploy the
Python package, and (c) restart the process, because the dispatch constant `CS`
and every algorithm parameter (`P_VALUE`, `EQ_CONDITION`, `HT_QUERY_TYPE`, …)
were module-level singletons fixed at import. Two users could not even run two
different configurations inside the same process. Notably, `P_VALUE` — the
significance threshold of the statistical hypothesis test — was not merely read
from a file but *hard-coded to `0.0`* in the source, which meant the test could
never accept two distributions as equal without editing the code.

The design goal for the replacement was to reduce these to a single principle:
**anything that differs between case studies must be expressible as user
input.** Four sub-principles guided the work:

- **G1 — Schema-first.** Every case-study-specific fact lives in a JSON
  document the user edits in the UI.
- **G2 — Behaviour-preserving.** Existing case studies must still learn the
  same SHAs; this is a refactoring, not a re-derivation of the algorithm.
- **G3 — Best-effort fallback.** A missing JSON field yields a sensible
  default; a missing CSV column becomes a zero-filled signal plus a warning,
  never a crash.
- **G4 — Sandbox safety.** User-supplied guard expressions are evaluated by
  Python's `eval`, so the evaluation environment must be restricted to a tiny,
  safe sub-language.

### 5.1.2 Proposed Full-Stack Design (React, Django, Celery, Redis)

The engine is delivered as a four-tier web application. Each tier has a single
responsibility, and the boundaries between them are exactly the boundaries at
which the legacy monolith was hardest to configure.

```
 ┌──────────────┐   HTTP/multipart    ┌──────────────┐   task id    ┌──────────────┐
 │   React SPA  │ ──────────────────► │  Django REST │ ───────────► │    Redis     │
 │  (browser)   │  JSON + trace files │   (API tier) │  enqueue     │   (broker)   │
 └──────────────┘                     └──────┬───────┘              └──────┬───────┘
        ▲                                    │ persist                     │ deliver
        │ poll status / download PDF         ▼                             ▼
        │                             ┌──────────────┐              ┌──────────────┐
        └─────────────────────────────│   SQLite DB  │◄─────────────│ Celery worker│
                                       │ (CaseStudy)  │  save result │ (L*-SHA core)│
                                       └──────────────┘              └──────────────┘
```

**React (presentation).** A single-page application collects the case-study
definition through a multi-step form (`FormPage1`…`FormPage6`) whose transient
state is held in a `useReducer` store (`CustomCsContext`). The form uploads the
UPPAAL model/query or the CSV bundle, extracts column headers on the client
(`ParseCSV.js`, `ParseUppaal.js`) so the user can pick variable roles from a
dropdown rather than typing them, and finally serialises the whole definition —
algorithm hyper-parameters plus the nested `user_json` document — into one
multipart POST.

**Django + Django REST Framework (API and persistence).** A `CaseStudy` model
(`rest_api/models.py`) stores every field of the definition: the strategy, the
variable-role fields, the free-form `user_json` (a `JSONField`), the algorithm
hyper-parameters (`noise`, `p_value`, `mi_query`, `ht_query_type`,
`eq_condition`, `n_min`, `is_aggregation`, …), the uploaded files, and — once
the run completes — the result PDF and DOT source. Uploaded CSVs are stored as a
one-to-many `CsvFile` relation so a case study can own an arbitrary bundle. Two
`ModelViewSet`s expose the standard REST surface. Crucially, **every algorithm
parameter that used to be a module-level constant is now a database column**,
so different case studies coexist with independent settings.

**Celery + Redis (asynchronous execution).** Learning a SHA can run for minutes
(UPPAAL simulation, DDTW fitting, KS tests, table closure). Doing it inside the
request/response cycle would block the API and time out the browser. Instead the
API enqueues a single Celery task, `run_lsha_learning_task(case_study_id)`, onto
a Redis broker and returns immediately; the browser then polls the case-study
status until it flips to `COMPLETED`. Redis serves as both the message broker
and the result backend, and a dedicated worker process consumes the queue.

The clean separation means the *entire* legacy monolith collapses into one
Celery task that reads a `CaseStudy` row and drives the case-study-agnostic
core. Adding a new system never touches the API, the worker, or the algorithm —
only the data in the row changes.

### 5.1.3 Containerization and Docker Environment Setup

The whole stack is reproducible through Docker Compose, which is important
because the engine has an awkward native dependency: it must be able to invoke
the UPPAAL `verifyta` binary and render Graphviz PDFs. The `backend` image is
built from `python:3.10-slim-bookworm` and installs the system libraries the
learner needs at runtime:

```dockerfile
FROM python:3.10-slim-bookworm
RUN apt-get update && apt-get install -y --no-install-recommends \
      build-essential graphviz libgraphviz-dev pkg-config \
    && rm -rf /var/lib/apt/lists/*
```

`docker-compose.yml` wires five services together:

| Service | Role | Notes |
|---|---|---|
| `redis` | Message broker + result backend | `redis:7-alpine`, port 6379 |
| `backend` | Django API server | builds `./backend`, port 8000 |
| `celery-worker` | Runs `run_lsha_learning_task` | same image, `celery -A lsha_web worker` |
| `frontend-dev` | Vite dev server | `dev` profile, port 5173 |
| `frontend-prod` | nginx-served static build | `prod` profile, port 80 |

Two design points are worth highlighting. First, the `backend` and
`celery-worker` services are built from the *same* image and share the same
source volume; they differ only in their launch command, so the task code the
worker executes is byte-identical to the code the API imports. Second, UPPAAL is
deliberately *not* containerised, for reasons that are worth recording.

The obvious approach — bind-mounting the host's UPPAAL installation read-only at
`/opt/uppaal` — does not work. UPPAAL 5.x segfaults immediately inside any
container: `strace` shows it probing hardware-identity sources for its licence
check (`/dev/disk/by-uuid`, `/dev/disk/by-id`, the network interface list,
`/etc/mtab`) and then dereferencing a null pointer once those come back empty or
unrecognised. The crash reproduces with `seccomp=unconfined`,
`apparmor=unconfined`, `--privileged`, `--pid=host`, and full `/dev`, `/sys` and
`/etc/machine-id` mounts; the same binary runs correctly on the host. It is a
defect in the proprietary licensing code, not a container misconfiguration, and
so it cannot be resolved from the Docker side at all.

The adopted solution keeps `verifyta` native and introduces a thin bridge
(`uppaal-bridge/`). A small standard-library HTTP service runs on the host and is
the only component that executes the real binary; inside the image, the path
`/opt/uppaal/lib/app/bin/verifyta` is occupied by a shim that presents the same
command-line interface, forwards the model and query *contents* to the bridge,
and replays the returned stdout, stderr and exit status. Because the shim is
faithful to the subprocess contract, `dynamic_tracegenerator.py` required no
modification: it still issues `subprocess.run([verifyta, '-t0', model, query])`
and still captures the trace on stdout. The licensed binary stays off the image
entirely, and CSV-strategy case studies — which never invoke UPPAAL — run with
the bridge stopped.

---

## 5.2 The Configuration Layer: User-Facing JSON Schema

The configuration contract is the heart of the "no-code" promise: it is the
single artefact that replaces the old `sul_functions.py` + `config.ini` pair.
It is a JSON document with a small number of top-level sections.

```json
{
  "case_study": "GREEN",
  "version":    "V2",
  "variables":  [ /* §5.2.1 — role declarations */ ],
  "models":     [ /* flow-condition families */ ],
  "events":     [ /* §5.2.2 — discrete symbols + guards */ ],
  "constants":  { /* symbolic thresholds */ },
  "aliases":    { /* friendly → physical column names */ },
  "trace_generation": { /* strategy + parser options */ }
}
```

### 5.2.1 Contract Interface and Role Declarations

The pivotal abstraction is the `variables[]` block, which lets the user
*declare a role* for each signal instead of positionally hard-coding it. Each
entry has the shape:

```json
{ "name": "F", "source": "humanFatigue[currH - 1]",
  "type": "REAL", "role": "estimated" }
```

with these semantics:

| Field | Required | Meaning |
|---|---|---|
| `name` | yes | Friendly label used in guards (`F`, `RPM`, `MarciaDecanter`). |
| `source` | no | Physical column name in the trace; defaults to `name`. |
| `type` | no | `REAL` / `INT` / `BOOL` — documentary; values are coerced numerically. |
| `role` | yes | Determines downstream handling (below). |

Three roles are understood:

- **`estimated`** — the single observable variable the SHA is learning. It is
  mapped internally to the reserved key `main`. Exactly one is supported.
- **`driver`** — a signal whose value drives discrete mode transitions.
  Multiple drivers are allowed (GREEN declares six boolean drivers).
- **`context`** (or anything else) — an auxiliary signal available to guards
  but not used to trigger change-point detection.

This declarative block is what decouples *what a signal means* (its role) from
*where it lives in the file* (its `source` column). It replaces three formerly
separate, positional concepts — `main_var`, `driver_signal`, and the fixed
`signals[0]`/`signals[1]`/`signals[2]` indices — with named roles that the rest
of the engine resolves at runtime. The helper `_resolve_variable_roles` reads
the block and, only when the corresponding legacy field is empty, derives
`main_var`, `driver`, and `context_variables` from it; an explicit setting from
the UI always wins, so the contract is non-destructive and idempotent.

Alongside `variables[]` the user declares `models[]` (the flow-condition
families — `MEAN`, `CONSTANT`, `LINEAR`, `EXP_DECAY`, `EXP_GROWTH`,
`LINEAR_DECAY`, `LINEAR_GROWTH`) and `events[]` (the discrete alphabet, covered
next). Symbolic `constants` keep magic numbers out of guards (a guard reads
`PRESSURE >= p_min` rather than `PRESSURE >= 50.0`), and `aliases` provides a
top-level friendly→physical mapping equivalent to the per-variable `source`
field.

### 5.2.2 Dynamic Guard Parsing and Evaluation

An **event** is a discrete symbol of the L\* alphabet, declared together with
the flow that becomes active after it fires and a boolean *guard* that decides
when it fires:

```json
{ "symbol": "dec_on", "model_id": 0,
  "guard": "MarciaDecanter == 1 and prev.MarciaDecanter == 0" }
```

The guard is a Python-style boolean expression written in the user's friendly
names. It may reference any signal's current value, any signal's previous value
via the natural `prev.X` attribute syntax, and any symbolic constant. Guards are
evaluated in **definition order**, and the first one that matches wins; an empty
guard (`""`) is an unconditional catch-all, so the last event can serve as a
default branch (the GREEN definition ends with `{ "symbol": "idle", "guard": "" }`).

This single mechanism replaces every legacy `if/elif` chain keyed on
`CS_VERSION`. Where the old thermostat module branched on version numbers 1–10
in Python, the user now expresses the same logic as a list of guard strings that
the engine evaluates generically. The precise parsing-and-evaluation pipeline —
the `prev.` rewrite, the placeholder substitution that makes dotted names like
`t.ON` and Boolean-OR composites like `amy.busy || amy.p_2` behave, and the
restricted `eval` sandbox — is a property of the SUL layer and is described in
detail in Section 5.3.3.

---

## 5.3 The System Under Learning Layer (`dynamic_sul.py`)

The SUL is the layer between raw trace data and the learning algorithm. It
answers three questions for any word the learner asks about: *where are the
change points in a trace?*, *which event label applies at each point?*, and
*which physics parameter characterises each segment?* The dynamic SUL replaces
the entire family of hand-written `sul_functions.py` files with one
configuration-driven module exposing four entry points:

```python
parse_data_dynamic(file_paths, args)          -> dict[str, np.ndarray]
is_chg_pt_dynamic(signals, index, args)       -> bool
label_event_dynamic(signals, index, args)     -> str          # event symbol
get_physics_param_dynamic(signals, s, e, args) -> {'mean', 'rate'}
```

Every entry point consumes the same `args` dictionary — assembled in `tasks.py`
from the `CaseStudy` row — and a uniform *signals dictionary*:

```python
{ 'time': np.ndarray,          # seconds from trace start
  'main': np.ndarray,          # the estimated variable
  '<driver>': np.ndarray, ... } # one array per driver / context signal
```

All arrays share length and indexing, so `signals[k][i]` is always "the value
of signal `k` at sample `i`." The reserved key `main` holds the estimated
variable; every other key is a friendly name. The decisive architectural change
is that **downstream code addresses signals by dictionary key, never by
position** — the failure mode of `signals[0]`/`signals[2]` positional access is
structurally eliminated.

### 5.3.1 Universal Data Loading and Normalization

`parse_data_dynamic` is the single ingestion point for both data regimes. It
inspects `trace_generation.strategy` (or the model-level `resample_strategy`),
routes `SIM`/`CSV` to `_parse_csv` and anything else to `_parse_uppaal`, and
returns the uniform signals dictionary either way.

The CSV route applies a fixed preprocessing pipeline, ordered so that each step
sees clean input from the previous one:

| # | Step | Purpose |
|---|---|---|
| 0 | Splice in `boolean_files` / `real_files` | Merge GREEN-style multi-file groups |
| 1 | `read_csv` + `concat` | Combine a multi-file bundle into one frame |
| 1b | Filter rows by `filter_object` | Isolate one device in a long SCADA dump |
| 1c | Coerce `True`/`False` → `1`/`0` | Let pivot aggregation and `==` guards work |
| 1d | Drop duplicate `(timestamp, field)` | Avoid `0.5` averages from double-writes |
| 2 | Pivot long → wide | Turn `(time, field, value)` rows into columns |
| 3 | Apply `replace_values` | Map custom string tokens to numbers |
| 4 | Zero-reference the time axis | Both ISO-`datetime` and `numeric` formats |
| 5 | Interpolate NaN gaps (dtype-aware) | Reconcile sparse, mixed-cadence sensors |
| 5b | Derive columns (e.g. `d/dt` of a totalizer) | Turn cumulative kWh into instantaneous power |
| 6 | Round columns to buckets | Discretise jittery RPM via `round_columns` |

Two normalization decisions deserve emphasis. First, interpolation is
**dtype-aware**: boolean-like columns (values strictly in `{0,1}`) are
forward-filled, while real columns follow the user's `interpolate_method`.
Linearly interpolating between a `0` and a `1` would synthesise physically
meaningless `0.5` samples that silently break both boolean change-point
detection and `prev.X == 0` edge guards; forward-fill preserves UPPAAL/SCADA
hold-last-value semantics. Second, the whole routine is wrapped in
`try/except` and returns an empty dict on catastrophic failure rather than
aborting the Celery worker (goal **G3**), while still logging a full traceback
and a one-glance diagnostic summary (row count, time span, per-signal min/max/
mean/uniqueness) that makes "only one event ever fires" pathologies obvious
before the L\* loop starts.

The UPPAAL route (`_parse_uppaal`) reads `verifyta`'s plain-text output —
section headers followed by `[0]: (t,v) (t,v) …` lines — builds a union time
axis across all requested variables, and forward-fills each variable onto that
grid (again matching UPPAAL's hold-last-value semantics). Additional simulation
runs (`[1]:`, `[2]:`, …), which arise from non-deterministic deadlocks and would
double-count events, are deliberately ignored.

### 5.3.2 Fuzzy Column Matching for Industrial Datasets

Real industrial variable names are hostile to clean identifiers. UPPAAL emits
section headers such as `humanFatigue[currH - 1]` (a bracketed array access) and
`amy.busy || amy.p_2` (a Boolean-OR composite); these cannot be renamed without
editing the UPPAAL model itself. The `aliases`/`source` mechanism therefore lets
the user keep a friendly name (`F`, `h.busy`) in every guard while the parser
locates the awkward physical header in the file.

Matching that header robustly requires tolerating whitespace and operator-syntax
differences between what the user typed and what UPPAAL printed. `dynamic_sul`
handles this with two helpers:

- **`_uppaal_normalize`** rewrites English logical keywords into UPPAAL
  operators, so a user who types `"amy.busy or amy.p_2"` is matched against the
  printed `"amy.busy || amy.p_2"`.
- **`build_robust_pattern`** strips all whitespace from the target name and then
  interleaves an `\s*` between every character before searching, so
  `amy.busy||amy.p_2` matches `amy.busy || amy.p_2` regardless of how UPPAAL
  spaced the header.

A further subtlety handled here is that the Django form may store *physical*
column names (`HEADSTOCK__SPINDLE_MOTOR___1___RPM`) even though the JSON
`variables[]` block declares the *friendly* name (`RPM`). `_build_target_vars`
constructs both a forward (friendly→physical) and a reverse (physical→friendly)
map so that, whichever spelling the user typed, the driver ends up keyed under
its friendly name in the signals dict. Without this reconciliation, guards
written in friendly names would silently never find their value — every guard
would evaluate `False`, and the run would produce zero change points.

### 5.3.3 Sandbox Guard Execution and Attribute Syntax

Guards are user-supplied strings evaluated by `eval`, so `safe_eval` restricts
the evaluation to a tiny, side-effect-free sub-language (goal **G4**). Its
pipeline has three stages:

1. **`prev.X` rewrite.** A precompiled regex `\bprev\.` substitutes `prev.X` →
   `prev_X`, so the natural attribute syntax maps to the internal `prev_<key>`
   value that `label_event_dynamic` places in the context.

2. **Placeholder substitution.** Each context key is replaced in the expression
   by a positional token `__VAR_i__`, and its value is bound to that token in
   the eval namespace. Keys are processed **longest-first** so that `RPM` cannot
   clobber the substring inside `prev_RPM`. This stage is what makes dotted
   names (`t.ON`, `r.open`, `h.busy`) and operator composites
   (`amy.busy || amy.p_2`) work at all: they are matched as plain strings, so
   Python's attribute lookup and its `||` syntax error never fire. For example,
   `amy.busy || amy.p_2 == 1.0` is rewritten to `__VAR_0__ == 1.0` — valid
   Python — before `eval` ever sees it.

3. **Restricted `eval`.** The namespace contains only the placeholder bindings
   and the `math` module; `__builtins__` is set to `None`, so a guard cannot
   import modules, open files, or call `exec`. Any exception — including a
   typo'd constant — is caught, logged for the first few occurrences (with the
   offending expression and the list of available names, so the user can
   diagnose it), and treated as `False`. A bad guard therefore degrades one
   event to "never fires" rather than crashing the run.

`label_event_dynamic` builds the context for each sample — every signal's
current value under its friendly name, every previous value under `prev_`, the
estimated variable exposed under both `main` and its friendly name, plus all
symbolic constants — and returns the first event whose guard matches, falling
back to the first declared symbol (the catch-all) when none do.

Change-point detection (`is_chg_pt_dynamic`) then layers two checks. **CHECK 1**
declares a change point whenever the event *label* differs from the previous
sample's — this catches every discrete transition regardless of which driver
caused it. **CHECK 2** additionally fires when a numeric driver steps beyond a
configured per-driver tolerance (`physics_constants.tolerances`). Boolean
drivers, detected data-drivenly at parse time, always use strict equality so a
`0→1` transition always registers; numeric drivers with *no* configured
tolerance deliberately skip CHECK 2 and rely on CHECK 1, which prevents RPM
micro-jitter from producing a spurious change point at every sample.

Finally, `get_physics_param_dynamic` characterises a segment by dispatching on
the *declared* model type of the active event's flow (looked up
symbol → `model_id` → `models[].type`) and applying the matching estimator: the
arithmetic mean for `MEAN`/`CONSTANT`, a signed slope for the `LINEAR`
families, and a log-ratio rate for `EXP_DECAY`/`EXP_GROWTH`. This is the generic
replacement for the legacy per-case-study `get_thermo_param` / `get_power_param`
/ `get_ftg_param` functions, none of which shared any code.

---

## 5.4 The Trace Generation Interface (`dynamic_tracegenerator.py`)

The Trace Generator is the bridge between the learner — which periodically asks
"give me more traces" through `get_traces(n)` — and the underlying data source.
A single class, `CustomTraceGenerator`, presents one API over two very different
strategies, normalising the many historical spellings of each
(`SIM`/`CSV`/`STATIC` → `CSV`; `UPPAAL`/`UPP`/`VERIFYTA` → `UPPAAL`) so every
downstream comparison agrees on a canonical value.

### 5.4.1 Simulated Paths via Runtime UPPAAL Patches

In UPPAAL mode the "data source" is a stochastic model, and each `get_traces(n)`
call runs `n` fresh simulations. Before each batch, `fix_model` **patches the
`.xml` model file in place** so that the simulator replays exactly the event
sequence the Teacher wants to explore. Three lines are rewritten on every call:

- **`int <force_var>[MAX_E] = {…};`** — the trigger sequence, built by
  `build_event_strings` from the current word's events and padded to `MAX_E`
  with `-1`. This supports both single-driver case studies (one force array) and
  multi-driver ones (`xml_force_variables` lists several arrays, each populated
  from a per-event `trigger_values` dict).
- **`bool <action_var> = true;`** — forces the model to honour the injected
  events instead of running its native non-deterministic logic.
- **`const int TAU = …;`** — the simulation horizon, scaled to
  `max(event_count × 50, 200)` so short prefixes are not truncated.

`verifyta` is then spawned as a subprocess with `-t0`, its stdout redirected
into a freshly named trace file (the name embeds a random 32-bit integer to
avoid collisions between parallel runs), and the result is validated non-empty
before being returned. A budget guard (`max_uppaal_budget`) short-circuits the
loop after a fixed number of simulations to prevent runaway disk usage if the
table never converges.

### 5.4.2 Static Paths via Multi-File CSV Management

In CSV mode the data source is a fixed bundle of files uploaded once, so no
generation happens — the generator's job is to *assemble* the bundle. At
construction it augments the primary file list with any extra groups declared in
the JSON (`boolean_files`, `real_files`, `extra_files`, and the same keys inside
the nested `csv:` block), keeping only absolute paths that actually exist on disk
and de-duplicating against files already present. This is what lets GREEN split
its boolean signals and its real-valued signals across separate CSVs: the
generator merges them into one list, and the SUL's `_parse_csv` concatenates and
pivots them back into a single coherent time series.

### 5.4.3 Loop Prevention and Yield-Once Execution Logic

The L\* refinement loop is written to keep asking the trace generator for more
evidence while any table cell is still ambiguous. That is correct for UPPAAL,
where each request yields a genuinely new simulation — but fatal for a *static*
CSV bundle, where re-answering the request would hand back identical rows
forever and the Teacher would spin without converging.

The generator resolves this with **yield-once semantics**. A `csv_yielded` flag
causes `get_traces_csv` to return the full file list on its first call and an
empty list on every subsequent call:

```python
def get_traces_csv(self, n=1):
    if not self.csv_files:
        return []                # nothing to give
    if not self.csv_yielded:
        self.csv_yielded = True
        return self.csv_files    # full bundle, ONCE
    return []                    # all subsequent calls
```

The Teacher interprets the empty list as "no further refinement possible" and
gracefully exits the loop. The learned SHA is thus the best hypothesis
obtainable from one full pass over the available field data — exactly the
correct semantics when no more data can be acquired. (`tasks.py` installs an
equivalent one-shot closure for the same reason, and offers a `bundle_all_csv`
option to merge every file into a single trace when the files cover the same
time window rather than distinct operating episodes.)

---

## 5.5 The Automated Teacher Core (`teacher.py`)

`CustomTeacher` is the "oracle" half of L\*-SHA. Where the legacy teacher read
all its behaviour from module-level constants fixed at import, `CustomTeacher`
receives a `config_data` dictionary at construction — built directly from the
`CaseStudy` row — and stores each hyper-parameter as an instance attribute. Two
users with two different configurations can therefore run concurrently, each
with its own teacher object. Every hard-coded case-study special case in the old
teacher (the `CS == 'THERMO'` model index, the `CS in ['ENERGY','AUTO_TWIN']`
counterexample branch) was removed: the teacher now trusts the model index and
event alphabet declared in the user's JSON and applies the same L\* logic to
every system. The teacher answers five queries — model identification
(`mi_query`), hypothesis testing (`ht_query`), row equality (`eqr_query`),
refinement (`ref_query`), and counterexample search (`get_counterexample`). The
two that most directly enable universality are examined below.

### 5.5.1 Statistical Hypothesis Testing via Kolmogorov–Smirnov

The hypothesis-testing query decides which probability distribution best
explains the parameter samples of a given flow — i.e. whether a newly observed
segment belongs to an existing distribution or requires a fresh one.
`ht_query` routes to one of two backends according to the user's
`ht_query_type`:

- **Deterministic (`D`).** Exact match on the scalar parameter. Two segments
  share a distribution only if their fitted parameters are numerically equal.
  This suits noiseless UPPAAL-derived metrics (THERMO's `R`/`K`, HRI's fatigue
  rates), where the values come back clean.

- **Stochastic (`S`).** A two-sample **Kolmogorov–Smirnov** test
  (`scipy.stats.ks_2samp`) compares the new samples against each existing
  distribution's samples and returns a *p*-value. When the *p*-value exceeds the
  user's `p_value` threshold the two are treated as statistically
  indistinguishable and merged; otherwise a new `ProbDistribution` is allocated.
  This suits noisy real sensors (ENERGY, GREEN).

The `is_aggregation` flag controls how samples are prepared for the test. With
`is_aggregation = False` each observed metric is used directly as a data point
(no synthetic expansion) — appropriate for deterministic data or exact matching.
With `is_aggregation = True` the metrics are expanded to 50 samples perturbed by
Gaussian noise of standard deviation `self.noise`, simulating the stochastic
variation of a physical process. When `noise = 0` the RNG is skipped entirely so
that repeated runs on identical data are bit-for-bit reproducible.

This is the direct remedy for the legacy `P_VALUE = 0.0`, which — because a
*p*-value can never fall below zero in a way that fails `pvalue >= 0.0` — meant
distributions were *never* merged and the learner allocated a fresh distribution
for every single segment (the "infinite distribution chain" pathology). Exposing
`p_value`, `noise`, and `is_aggregation` as user knobs restores control over the
statistical test that the old code had frozen shut.

### 5.5.2 Equivalence Checking under Data Sparsity

`eqr_query` decides whether two observation-table rows represent the same
automaton location, and it supports two regimes selected by the user's
`eq_condition`:

- **Strict (`s`).** Rows must agree cell-for-cell, *including* cells neither row
  has observed. This matches the published L\*-SHA semantics and is correct when
  traces are dense enough to fill the table — the UPPAAL-driven THERMO and HRI
  studies.

- **Weak (`w`).** Two rows are equal as long as the cells they have *both*
  observed agree; an unobserved cell acts as a wildcard:

  ```python
  for i, state in enumerate(row1.state):
      if state.observed() and row2.state[i].observed() and state != row2.state[i]:
          return False
  return True
  ```

Weak equality is the accommodation that makes learning from **sparse real-world
data** tractable. Industrial CSV dumps (ENERGY, GREEN) exercise only a fraction
of the possible prefix/suffix combinations, so a long tail of table cells is
never observed. Under strict equality those unobserved cells would prevent rows
from ever being declared equal, the table would never close, and the L\* loop
would stall indefinitely. Weak equality lets the algorithm identify locations
from partial evidence and terminate on a sensible hypothesis. The choice is
threaded consistently through every place equivalence is tested — the teacher's
`not_closed`/`not_consistent` checks and the observation table's `to_sha` and
`get_loc_from_word` — all of which read `eq_condition` live from the teacher's
config rather than from a global constant.

The refinement query rounds out the sparsity handling: it flags words that have
fewer than `n_min` observed segments or that are consistent with multiple rows,
requests fresh traces for each, and — via a per-word failure counter — marks a
word "exhausted" after it fails to yield new segments a few times in a row, so
the loop terminates even when some first-event prefixes are structurally
unreachable in the model.

---

## 5.6 The Algorithmic Bookkeeping (`dynamic_obstable.py` & `tasks.py`)

### 5.6.1 Observation Table Closure and Consistency Operations

The observation table is the central L\* data structure. It is indexed by rows —
words from the prefix-closed set `S` (upper rows) plus their one-step extensions
`low_S` (lower rows) — and by columns, the distinguishing suffixes `E`. Each
cell `(s, e)` stores the `(model, distribution)` pair the teacher returns for the
word `s·e`. The learner repeatedly asks whether the table is **closed** (every
lower row matches some upper row) and **consistent** (equivalent rows stay
equivalent when extended by any symbol), and refines `S` or `E` whenever either
property breaks.

`dynamic_obstable.py` keeps this module **strictly case-study agnostic**: it
never inspects an event symbol or a signal value. All semantic decisions —
strict vs weak equality, which flow fits which segment — live in the teacher; the
table only manages bookkeeping and reconstructs the final SHA. Making it generic
required removing the assumptions the legacy table baked in:

- **No embedded configuration.** The old table imported `configparser` and read
  `EQ_CONDITION` at module load. The dynamic table instead reads
  `teacher.config['eq_condition']` live inside each method
  (`get_loc_from_word`, `to_sha`), so the value always reflects the current run.

- **Generic flow labels.** The old `to_sha` built each location's label by
  hard-coded two-variable access `row.state[0].vars[0][0].label + ', ' +
  row.state[0].vars[0][1].label`, which crashed with `IndexError` for any case
  study that did not have exactly two variables (Energy has one, a custom study
  might have three). The dynamic version flattens whatever variable structure a
  row carries and joins the labels generically, so 1-D, 2-D, and n-D layouts all
  render.

- **Crash-safe rendering.** `__str__` guarded its column-width computation with
  `max(...)` over possibly-empty sequences, which raised `ValueError` on the
  empty table that exists before the first observation. A `max(valid_lens) if
  valid_lens else 8` fallback makes logging safe at every stage.

The `to_sha` method performs the reconstruction: it walks the upper rows,
deduplicates them under the active equality to yield one `Location` per distinct
row, then adds an `Edge` for every observed `(s, e)` cell by mapping the source
and destination words to their locations, and finally attaches initial edges and
runs a sanity check.

### 5.6.2 Asynchronous Celery Pipeline and Report Generation

`run_lsha_learning_task(case_study_id)` is the Celery task that assembles every
component described in this chapter into one end-to-end pipeline. Its phases are:

| Phase | Action |
|---|---|
| 0 | Load the `CaseStudy` row from the database |
| 1 | Normalise the strategy to `CSV` or `UPPAAL`; probe for `verifyta` |
| 2 | Parse `user_json`; pre-resolve `variables[]` so `main_var`/`driver` are populated even when the DB fields were blank |
| 3 | Construct the `CustomTraceGenerator` (and, for CSV, install the yield-once closure) |
| 4 | Gather the input files (uploaded CSVs from the `CsvFile` table, or a first UPPAAL simulation) |
| 5 | **Smoke-test** the SUL: parse one trace, scan for change points, and log an event-symbol histogram — the single most useful early warning for guard/tolerance mistakes |
| 6 | Build the four SUL *adapters* that translate between the dict-of-arrays internal format and the `SampledSignal`/`SignalPoint` types the L\* core expects |
| 7 | Construct the `SystemUnderLearning` |
| 8 | Construct the `CustomTeacher` from the row's hyper-parameters |
| 9 | Construct the initial `ObsTable` (one row per event in Σ) |
| 10 | Run `Learner.run_lsha(filter_empty=True)` |
| 11 | Render the learned SHA to PDF + DOT via Graphviz |
| 12 | Save the PDF/DOT back onto the `CaseStudy` row and mark it `COMPLETED` |
| 13 | Generate the experimental report (event tables, distributions, runtime) |

The adapters in Phase 6 are the seam that lets a generic dict-based engine drive
a core written against typed signal objects. `parse_adapter` calls
`parse_data_dynamic`, caches the resulting dict on `args` under
`__current_trace_cache__`, and re-emits it as `CustomSignal` objects labelled by
friendly name. Because the legacy core's `find_chg_pts` hands the change-point
hook only *value tuples* with no timestamp, `parse_adapter` also resets a
per-trace iteration counter that `is_chg_pt_adapter` increments, mapping each
call positionally back to a sample index in the cached dict — a subtle but
essential bridge, since an earlier timestamp-recovery attempt silently
degenerated to comparing only the second driver. `get_physics_param_adapter`
additionally decides, from the segment's declared flow type, whether to report
the segment *mean* or its *rate*: cumulative counters (like the energy
totalizer) are monotonic, so two segments of the same physical mode have
different means but the same slope, and reporting the mean to the deterministic
HT-query would allocate a new distribution per segment. Reporting the rate for
the `LINEAR`/`EXP` flow families keeps the metric stable and lets the table
close.

On success the task writes the automaton PDF and its DOT source to the
`CaseStudy` row's `final_result_pdf` / `final_result_txt` fields and flips
`status` to `COMPLETED`; the React client, which has been polling, then offers
the results for download. The experimental report — event symbol tables, learned
distributions, signal counts, and wall-clock runtime — is produced by the
library's `lsha_report.save_data`. Any failure at any phase is caught, logged
with a full traceback, and returned to the caller as a structured error rather
than being allowed to kill the worker.

---

## Summary

The engine turns a case-study-specific research monolith into a single generic
pipeline whose behaviour is entirely determined by user data. Every constant,
positional index, version branch, and case-study special case that the legacy
code hard-coded has been mapped to a field of the JSON contract or the
`CaseStudy` row:

| Legacy hard-coding | Location | Replaced by |
|---|---|---|
| `SPEED_RANGE`, `MIN_SPEED`, `MAX_SPEED` | `sul_functions.py` | `constants` / `physics_constants` in JSON |
| Positional signal indices `signals[0..2]` | all SUL functions | role-keyed signals dict via `variables[]` |
| `CS_VERSION` `if/elif` guard chains | `label_event` | `events[].guard` expressions |
| `CS == 'THERMO'` model index | teacher `mi_query` | `models[].id` in JSON |
| `CS in ['ENERGY',…]` counterexample branch | teacher | standard L\* for all studies |
| `P_VALUE = 0.0` (frozen) | teacher | `CaseStudy.p_value` |
| `EQ_CONDITION` module singleton | teacher + obstable | `CaseStudy.eq_condition`, read live |
| 2-variable flow-label access | obstable `to_sha` | generic variable flatten |
| CSV-vs-UPPAAL file handling | teacher `ref_query` | `resample_strategy` branch + yield-once |

The result is a system in which **defining a new case study requires zero Python
changes**: the user fills in the web form, uploads a trace bundle or an UPPAAL
model, and the engine — the SUL, the trace generator, the teacher, the
observation table, and the Celery pipeline — adapts entirely to what was
declared.
