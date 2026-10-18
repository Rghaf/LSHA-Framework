"""
generate_all.py — build the framework JSON for every legacy case study/version.

Every value emitted here is derived from the original hard-coded case studies in
``core_algorithm/lsha/sha_learning/case_studies/`` and from the reference
``sha_learning/resources/config/config.ini``. The per-family reasoning is written
up in docs/CASE_STUDY_{THERMO,HRI,ENERGY,GREEN}.md.

    python case_files/case_studies/generate_all.py
"""

import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
EMAIL = "reza.ghadiri.1998@gmail.com"

# ---------------------------------------------------------------------------
# config.ini  [LSHA PARAMETERS]
# ---------------------------------------------------------------------------
CFG = {
    "noise": 0.0,
    "n_min": 1,           # N_min = 1
    "p_value": 0.05,
    "mi_query": False,    # MI_QUERY = False
    "plot_ddtw": False,
    "ht_query": True,     # HT_QUERY = True
    "ht_query_type": "S", # HT_QUERY_TYPE = S
    "eq_condition": "W",  # EQ_CONDITION = w
}


def base(name, strategy, drivers, main, context, user_json, aggregation=False, **over):
    doc = {
        "name": name,
        "email": EMAIL,
        "resample_strategy": strategy,
        "driver_signal": drivers,
        "main_variable": main,
        "context_variables": context,
        **CFG,
        "is_aggregation": aggregation,
        # Which entry of models[] the Teacher falls back to when mi_query is
        # disabled — the reference's DEFAULT_M / DEFAULT_DISTR. Every case study
        # except thermostat uses 0; it is written out explicitly so the value is
        # visible and editable rather than assumed.
        "default_model_id": 0,
        "default_distribution_id": 0,
        # Matches the reference for every case study except THERMO, which
        # overrides this to "raw".
        "ht_sample_mode": "replicated",
        "user_json": user_json,
    }
    doc.update(over)

    # These are not columns on the CaseStudy model, so a multipart POST would
    # drop them at the serializer. Mirror them inside user_json, which is stored
    # verbatim and is what tasks.py reads. Keeping the top-level copy too means
    # a future model field / UI control works without changing the generator.
    doc["user_json"]["default_model_id"] = doc["default_model_id"]
    doc["user_json"]["default_distribution_id"] = doc["default_distribution_id"]
    doc["user_json"]["ht_sample_mode"] = doc["ht_sample_mode"]
    return doc


def write(family, stem, doc):
    path = os.path.join(HERE, family, f"{stem}.json")
    with open(path, "w") as fh:
        json.dump(doc, fh, indent=2)
        fh.write("\n")
    return len(doc["user_json"]["events"]), len(doc["user_json"]["models"])


# ===========================================================================
# THERMO  —  case_studies/thermostat/
# ===========================================================================
# sul_definition.py:
#   on_fc  = FlowCondition(0, on_model)   heating, bounded exp growth -> 70
#   off_fc = FlowCondition(1, off_model)  cooling, exp decay -> 0
#   DRIVER_SIG = 't.ON'                   single driver, all versions
#   parse_data variables = ['t.ON', 'T_r', 'r.open']
#
#   CS_VERSION in [1]                -> h_0(''),      c_0('')
#   CS_VERSION in [2..10]            -> h_0('!open'), c_0('!open'),
#                                       h_1('open'),  c_1('open')
#   CS_VERSION in [3,8,9,10]         -> + h_2('open2'), c_2('open2')
#   CS_VERSION in [9,10]             -> + FlowCondition(2, off_model_2)
#   CS_VERSION in [8]                -> + FlowCondition(2, on_model_2),
#                                         FlowCondition(3, off_model_2)
#
# sul_functions.label_event maps r.open onto those guards — INCONSISTENTLY:
#   [2,4,5,6,7] : r.open == 1 -> events[0].guard ('!open')   <-- inverted
#   [3,8,9,10]  : r.open == 2 -> 'open2'
#                 r.open == 1 -> 'open'                      <-- natural
#                 else        -> '!open'
# The two branches read the same signal in opposite ways; see the THERMO doc.
# Reproduced verbatim so the JSON matches the reference implementation.
THERMO_SIX  = [3, 8, 9, 10]
THERMO_FOUR = [2, 4, 5, 6, 7]


def thermo(version):
    # get_thermo_param uses ON_R = CLOSED_R = 100.0 and returns the *time
    # constant* for cooling but the gain K for heating. Verified against real
    # traces: these estimators recover 100.0000 and 0.7000, matching
    # OFF_DISTR[0] = 100.0 and ON_DISTR[0] = 0.7. The generic EXP_* branches
    # return 0.0100 and ~0.49 instead.
    models = [
        {"id": 0, "name": "Heating (on_model, exp. growth)", "type": "EXP_GROWTH",
         "estimator": "EXP_GROWTH_NEWTON", "time_constant": 100.0},
        {"id": 1, "name": "Cooling (off_model, exp. decay)", "type": "EXP_DECAY",
         "estimator": "EXP_DECAY_TAU"},
    ]
    if version == 8:
        models += [
            {"id": 2, "name": "Heating alt (on_model_2, linear)",  "type": "LINEAR_GROWTH"},
            {"id": 3, "name": "Cooling alt (off_model_2, linear)", "type": "LINEAR_DECAY"},
        ]
    elif version in (9, 10):
        models += [
            {"id": 2, "name": "Cooling alt (off_model_2, linear)", "type": "LINEAR_DECAY"},
        ]

    # ``trigger_value`` is the value the trace generator forces into the model's
    # force_open[] array when it wants that event next (see
    # dynamic_tracegenerator.build_event_strings). It must therefore be the
    # r.open value that SATISFIES the event's own guard — otherwise UPPAAL is
    # steered toward a state the guard rejects. Omitting it entirely encodes
    # every entry as -1, i.e. "don't force", which leaves the learner with
    # undirected random traces.
    if version == 1:
        # V1 does not model the window at all; r.open stays 0 throughout.
        events = [
            {"symbol": "h_0", "trigger_value": 0, "model_id": 0, "guard": "t.ON == 1"},
            {"symbol": "c_0", "trigger_value": 0, "model_id": 1, "guard": "t.ON == 0"},
        ]
    elif version in THERMO_FOUR:
        # inverted branch: r.open == 1 selects the '!open' pair
        events = [
            {"symbol": "h_0", "trigger_value": 1, "model_id": 0, "guard": "t.ON == 1 and r.open == 1"},
            {"symbol": "c_0", "trigger_value": 1, "model_id": 1, "guard": "t.ON == 0 and r.open == 1"},
            {"symbol": "h_1", "trigger_value": 0, "model_id": 0, "guard": "t.ON == 1 and r.open != 1"},
            {"symbol": "c_1", "trigger_value": 0, "model_id": 1, "guard": "t.ON == 0 and r.open != 1"},
        ]
    else:  # 3, 8, 9, 10 — natural branch, three window states
        events = [
            {"symbol": "h_0", "trigger_value": 0, "model_id": 0, "guard": "t.ON == 1 and r.open == 0"},
            {"symbol": "c_0", "trigger_value": 0, "model_id": 1, "guard": "t.ON == 0 and r.open == 0"},
            {"symbol": "h_1", "trigger_value": 1, "model_id": 0, "guard": "t.ON == 1 and r.open == 1"},
            {"symbol": "c_1", "trigger_value": 1, "model_id": 1, "guard": "t.ON == 0 and r.open == 1"},
            {"symbol": "h_2", "trigger_value": 2, "model_id": 0, "guard": "t.ON == 1 and r.open == 2"},
            {"symbol": "c_2", "trigger_value": 2, "model_id": 1, "guard": "t.ON == 0 and r.open == 2"},
        ]

    return base(
        f"THERMO-V{version}", "UPPAAL", ["t.ON"], "T_r", ["r.open"],
        {
            "case_study": "THERMO",
            "version": f"V{version}",
            "variables": [
                {"name": "T_r",    "source": "T_r",    "role": "estimated", "type": "REAL"},
                {"name": "t.ON",   "source": "t.ON",   "role": "driver",    "type": "INT"},
                {"name": "r.open", "source": "r.open", "role": "context",   "type": "INT"},
            ],
            "models": models,
            "events": events,
            "constants": {},
            "trace_generation": {
                "strategy": "UPPAAL",
                "xml_force_variable": "force_open",
                "max_length": 15,
                # Fixes verifyta's RNG so the same configuration replays the
                # same traces; remove to sample fresh traces each run.
                "seed": 42,
            },
        },
        # The reference's ht_s_query branches on `if CS == 'THERMO'`, feeding
        # ks_2samp the raw metrics; every other case study gets the replicated
        # + noised variant.
        ht_sample_mode="raw",
        # sul_definition.py: DEFAULT_M = 1, DEFAULT_DISTR = 1 — thermostat is the
        # only case study that does not default to 0. With mi_query disabled the
        # Teacher reports this flow on every location, so the reference renders
        # f_1 (the cooling model) throughout.
        default_model_id=1,
        default_distribution_id=1,
    )


# ===========================================================================
# HRI  —  case_studies/hri/
# ===========================================================================
# sul_definition.py:
#   idle_fc = FlowCondition(0, idle_model)  F0*exp(-0.003 t)        -> EXP_DECAY
#   busy_fc = FlowCondition(1, busy_model)  1-(1-F0)*exp(-0.004 t)  -> EXP_GROWTH
#   fatigue = RealValuedVar(..., label='0')  ; DRIVER_SIG = '2'
#
# parse_traces_uppaal signal order:
#   0 humanFatigue[currH - 1]      (main)
#   1 humanPositionX[currH - 1]
#   2 amy.busy || amy.p_2          (driver; V3+ adds || amy.run || amy.p_4)
#   3 humanPositionY[currH - 1]
#
# label_event: chan = 'start' if moving == 1 else 'stop'
#   -> u_* (start) = human moving  = busy  -> model 1
#   -> d_* (stop)  = human at rest = idle  -> model 0
#
# Region predicates:
#   UPPAAL  sit : posX >= 2000 and posY <= 3000
#           run : posX >= 2000 and 1000 <= posY <= 3000
#   SIM     sit : 16 <= posX <= 23 and 1 <= posY <= 10
#           run : 1 <= posX <= 11 and 1 <= posY <= 10
HRI_DRIVER_V12 = "amy.busy || amy.p_2"
HRI_DRIVER_V3P = "amy.busy || amy.p_2 || amy.run || amy.p_4"

# get_ftg_param returns abs(mean(log(F_i/F_{i-1}))) when idle and
# abs(mean(log((1-F_i)/(1-F_{i-1})))) when busy — i.e. the *rate*, unlike
# THERMO which wants the time constant. Ground truth: N_0[0]=0.003 (idle),
# N_1[0]=0.004 (busy).
HRI_MODELS = [
    {"id": 0, "name": "Idle (idle_model, exp. decay)",  "type": "EXP_DECAY",
     "estimator": "EXP_DECAY_RATE"},
    {"id": 1, "name": "Busy (busy_model, exp. growth)", "type": "EXP_GROWTH",
     "estimator": "EXP_GROWTH_SAT"},
]


def _hri_regions(strategy):
    if strategy == "UPPAAL":
        return ("posX >= 2000 and posY <= 3000",
                "posX >= 2000 and 1000 <= posY and posY <= 3000")
    return ("16 <= posX and posX <= 23 and 1 <= posY and posY <= 10",
            "1 <= posX and posX <= 11 and 1 <= posY and posY <= 10")


def hri(strategy, version):
    sit, run = _hri_regions(strategy)
    driver_expr = HRI_DRIVER_V12 if (strategy == "UPPAAL" and version in (1, 2)) else HRI_DRIVER_V3P

    # ``trigger_value`` fills the model's force_act[] array (see
    # dynamic_tracegenerator.build_event_strings). For HRI it selects the action
    # channel the generator should force next: u_* = 'start' (0), d_* = 'stop'
    # (1), matching the pre-existing hri_v1.json / hri_v5.json. Without it every
    # entry is -1 and the generator cannot steer UPPAAL toward the word being
    # refined.
    if strategy == "UPPAAL" and version == 1:
        events = [
            {"symbol": "u_1", "trigger_value": 0, "model_id": 1, "guard": "busy == 1"},
            {"symbol": "d_1", "trigger_value": 1, "model_id": 0, "guard": "busy == 0"},
        ]
    elif strategy == "UPPAAL" and version == 2:
        events = [
            {"symbol": "u_1", "trigger_value": 0, "model_id": 1, "guard": f"busy == 1 and ({sit})"},
            {"symbol": "d_1", "trigger_value": 1, "model_id": 0, "guard": f"busy == 0 and ({sit})"},
            {"symbol": "u_2", "trigger_value": 0, "model_id": 1, "guard": "busy == 1"},
            {"symbol": "d_2", "trigger_value": 1, "model_id": 0, "guard": "busy == 0"},
        ]
    else:
        # UPPAAL V3/4/5 and SIM V1/2/3 share the same three guard combinations:
        #   'sit!run', '!sitrun', '!sit!run'   ('sitrun' is not enumerated)
        events = [
            {"symbol": "u_2", "trigger_value": 0, "model_id": 1, "guard": f"busy == 1 and ({sit}) and not ({run})"},
            {"symbol": "d_2", "trigger_value": 1, "model_id": 0, "guard": f"busy == 0 and ({sit}) and not ({run})"},
            {"symbol": "u_3", "trigger_value": 0, "model_id": 1, "guard": f"busy == 1 and not ({sit}) and ({run})"},
            {"symbol": "d_3", "trigger_value": 1, "model_id": 0, "guard": f"busy == 0 and not ({sit}) and ({run})"},
            {"symbol": "u_4", "trigger_value": 0, "model_id": 1, "guard": "busy == 1"},
            {"symbol": "d_4", "trigger_value": 1, "model_id": 0, "guard": "busy == 0"},
        ]

    if strategy == "UPPAAL":
        variables = [
            {"name": "F",    "source": "humanFatigue[currH - 1]",   "role": "estimated", "type": "REAL"},
            {"name": "posX", "source": "humanPositionX[currH - 1]", "role": "context",   "type": "REAL"},
            {"name": "busy", "source": driver_expr,                 "role": "driver",    "type": "INT"},
            {"name": "posY", "source": "humanPositionY[currH - 1]", "role": "context",   "type": "REAL"},
        ]
        trace_gen = {
            "strategy": "UPPAAL",
            # trace_gen.py's HRI branch patches `int force_act[MAX_E]`;
            # force_open is THERMO's array and is the code default, so it must
            # be stated explicitly here.
            "xml_force_variable": "force_act",
            "max_length": 15,
            "seed": 42,
        }
    else:
        variables = [
            {"name": "F",    "source": "humanFatigue",  "role": "estimated", "type": "REAL"},
            {"name": "posX", "source": "humanPositionX", "role": "context",  "type": "REAL"},
            {"name": "busy", "source": "moving",         "role": "driver",   "type": "INT"},
            {"name": "posY", "source": "humanPositionY", "role": "context",  "type": "REAL"},
        ]
        trace_gen = {
            "strategy": "CSV",
            "csv": {"wide_or_long": "wide", "timestamp_column": "t",
                    "interpolate_method": "ffill"},
        }

    return base(
        f"HRI-{strategy}-V{version}",
        "UPPAAL" if strategy == "UPPAAL" else "CSV",
        ["busy"], "F", ["posX", "posY"],
        {
            "case_study": "HRI",
            "version": f"{strategy}_V{version}",
            "variables": variables,
            "models": HRI_MODELS,
            "events": events,
            "constants": {},
            "trace_generation": trace_gen,
        },
        aggregation=(strategy != "UPPAAL"),
    )


# ===========================================================================
# ENERGY  —  case_studies/energy/ (+ energy_sim, energy_made)
# ===========================================================================
# config.ini [ENERGY CS]: SPEED_RANGE=200 MIN_SPEED=100 MAX_SPEED=10000 PR_RANGE=500
#
# sul_definition.py builds the alphabet as
#   for i in range(MIN_SPEED, MAX_SPEED, SPEED_RANGE):
#       Event('{i}<=w<{i+RANGE}', 'start', 'm_<n>')     (last band open-ended)
#   + Event('', 'stop', 'i_0') + Event('', 'load', 'l') + Event('', 'unload', 'u')
# with one constant flow condition pwr_model -> MEAN.
#
# sul_functions.py:
#   parse_data : power = 60 * d(energy); speed rounded to 100 and clamped >= 0
#   is_chg_pt  : energy     -> |dw| > SPEED_RANGE or |dpr| > PR_RANGE
#                energy_sim -> |dw| > SPEED_RANGE or pr changed at all
#   label_event: pressure jump -> l / u ; speed below MIN_SPEED -> i_0 ; else band
COL_TS, COL_EN = "TimestampUTC", "HEADSTOCK__SPINDLE_DRIVE___1___ENERGY"
COL_RPM, COL_PR = "HEADSTOCK__SPINDLE_MOTOR___1___RPM", "RT__PALLET_LOCKING___1___PRESSURE"
PR_RANGE = 500


def energy(tag, speed_range, min_speed=100, max_speed=10000, pressure_exact=False):
    bands, i = [], min_speed
    while i < max_speed:
        upper = i + speed_range
        guard = f"{i} <= RPM and RPM < {upper}" if upper < max_speed else f"{i} <= RPM"
        bands.append({"symbol": f"m_{len(bands)}", "model_id": 0, "guard": guard})
        i = upper

    press_changed = ("PR != prev_PR" if pressure_exact
                     else f"math.fabs(PR - prev_PR) > {PR_RANGE}")
    # i_0 covers the whole idle region rather than only the downward crossing:
    # dynamic_sul falls back to the FIRST event when nothing matches, so the
    # alphabet must be total or sub-MIN_SPEED samples get mislabelled.
    events = [
        {"symbol": "l",   "model_id": 0, "guard": f"{press_changed} and PR > 500 and prev_PR <= 500"},
        {"symbol": "u",   "model_id": 0, "guard": press_changed},
        {"symbol": "i_0", "model_id": 0, "guard": f"RPM < {min_speed}"},
    ] + bands

    return base(
        f"ENERGY-{tag}", "CSV", ["RPM", "PR"], "POWER", [],
        {
            "case_study": "ENERGY",
            "version": tag,
            "variables": [
                {"name": "POWER", "source": "POWER_kW", "role": "estimated", "type": "REAL"},
                {"name": "RPM",   "source": COL_RPM,    "role": "driver",    "type": "REAL"},
                {"name": "PR",    "source": COL_PR,     "role": "driver",    "type": "REAL"},
            ],
            "models": [{"id": 0, "name": "Spindle power (pwr_model)", "type": "MEAN"}],
            "events": events,
            "constants": {"MIN_SPEED": min_speed, "MAX_SPEED": max_speed,
                          "SPEED_RANGE": speed_range, "PR_RANGE": PR_RANGE},
            "trace_generation": {
                "strategy": "CSV",
                "csv": {
                    "wide_or_long": "wide",
                    "timestamp_column": COL_TS,
                    "interpolate_method": "ffill",
                    "derive_columns": {COL_EN: {"factor": 60, "target": "POWER_kW"}},
                    "round_columns": {COL_RPM: 100},
                },
                "physics_constants": {
                    "tolerances": {"RPM": speed_range,
                                   "PR": 0 if pressure_exact else PR_RANGE}
                },
            },
        },
        aggregation=True,
    )


# ===========================================================================
# GREEN / GR3N  —  case_studies/gr3n/
# ===========================================================================
# config.ini [GR3N]: PUMP_SPEED_RANGE=5 MIN_PUMP_SPEED=20 MAX_PUMP_SPEED=70
#                    TMPRT_RANGE=3      MIN_TMPRT=10      MAX_TMPRT=30
#
# sul_definition.py:
#   Talim = RealValuedVar([FlowCondition(0, modello_assorbimento)], label='Ta')
#   speed bands  -> sp_<n>   over range(MIN_PUMP_SPEED, MAX_PUMP_SPEED, RANGE)
#   temp  bands  -> tmp_<n>  over range(MIN_TMPRT, MAX_TMPRT, TMPRT_RANGE)
#   + Event('', 'stop', 's')          ; DRIVER_SIG = ['sp', 'tmp']
#   NOTE symbols are numbered with len(events), so the temperature events
#   continue the speed numbering (sp_0..sp_9 then tmp_10..tmp_16).
#
# sul_functions.parse_data reads a LONG-format CSV and selects rows by
# DataObjectField: 'SpeedSP' -> sp, 'TCuscinettiAlimentazione' -> Ta, 'Value' -> tmp.
# is_chg_pt fires on a band-boundary CROSSING (either direction), not a tolerance.
def green(tag, sp_range=5, sp_min=20, sp_max=70, t_range=3, t_min=10, t_max=30):
    events = []
    i = sp_min
    while i < sp_max:
        upper = i + sp_range
        guard = f"{i} <= sp and sp < {upper}" if upper < sp_max else f"{i} <= sp"
        events.append({"symbol": f"sp_{len(events)}", "model_id": 0, "guard": guard})
        i = upper
    i = t_min
    while i < t_max:
        upper = i + t_range
        guard = f"{i} <= tmp and tmp < {upper}" if upper < t_max else f"{i} <= tmp"
        events.append({"symbol": f"tmp_{len(events)}", "model_id": 0, "guard": guard})
        i = upper
    events.append({"symbol": "s", "model_id": 0, "guard": ""})   # Event('', 'stop', 's')

    return base(
        f"GREEN-{tag}", "CSV", ["sp", "tmp"], "Ta", [],
        {
            "case_study": "GREEN",
            "version": tag,
            "variables": [
                {"name": "Ta",  "source": "TCuscinettiAlimentazione", "role": "estimated", "type": "REAL"},
                {"name": "sp",  "source": "SpeedSP",                  "role": "driver",    "type": "REAL"},
                {"name": "tmp", "source": "Value",                    "role": "driver",    "type": "REAL"},
            ],
            "models": [{"id": 0, "name": "Absorption (modello_assorbimento)", "type": "MEAN"}],
            "events": events,
            "constants": {"MIN_PUMP_SPEED": sp_min, "MAX_PUMP_SPEED": sp_max,
                          "PUMP_SPEED_RANGE": sp_range, "MIN_TMPRT": t_min,
                          "MAX_TMPRT": t_max, "TMPRT_RANGE": t_range},
            "trace_generation": {
                "strategy": "CSV",
                "csv": {
                    "wide_or_long": "long",
                    "timestamp_column": "TimeStamp",
                    "field_column": "DataObjectField",
                    "value_column": "Value",
                    "interpolate_method": "linear",
                    "bundle_all_csv": True,
                },
                "physics_constants": {"tolerances": {"sp": sp_range, "tmp": t_range}},
            },
        },
        aggregation=True,
    )


def green_real(tag="V3-REAL", ab_range=50, ab_min=0, ab_max=200,
               tr_range=20, tr_min=0, tr_max=80):
    """GREEN re-targeted onto the decanter exports that are actually present.

    The canonical gr3n definition drives on 'SpeedSP' and 'Value', neither of
    which appears in 20250202_DecanterData_REAL.csv. This keeps the gr3n
    *structure* — two independently banded drivers plus a trailing catch-all —
    but binds it to two signals the data really contains and that really vary:

        Assorbimento         0 .. 192   (absorbed current)
        TCuscinettiRiduttore 0 ..  80   (gearbox bearing temperature)

    with TCuscinettiAlimentazione (0 .. 58) still the estimated variable. This
    is the configuration used to exercise multi-driver change-point detection.
    """
    events = []
    i = ab_min
    while i < ab_max:
        upper = i + ab_range
        guard = f"{i} <= ab and ab < {upper}" if upper < ab_max else f"{i} <= ab"
        events.append({"symbol": f"ab_{len(events)}", "model_id": 0, "guard": guard})
        i = upper
    i = tr_min
    while i < tr_max:
        upper = i + tr_range
        guard = f"{i} <= tr and tr < {upper}" if upper < tr_max else f"{i} <= tr"
        events.append({"symbol": f"tr_{len(events)}", "model_id": 0, "guard": guard})
        i = upper
    events.append({"symbol": "s", "model_id": 0, "guard": ""})

    return base(
        f"GREEN-{tag}", "CSV", ["ab", "tr"], "Ta", [],
        {
            "case_study": "GREEN",
            "version": tag,
            "variables": [
                {"name": "Ta", "source": "TCuscinettiAlimentazione", "role": "estimated", "type": "REAL"},
                {"name": "ab", "source": "Assorbimento",             "role": "driver",    "type": "REAL"},
                {"name": "tr", "source": "TCuscinettiRiduttore",     "role": "driver",    "type": "REAL"},
            ],
            "models": [{"id": 0, "name": "Absorption (modello_assorbimento)", "type": "MEAN"}],
            "events": events,
            "constants": {"AB_RANGE": ab_range, "TR_RANGE": tr_range},
            "trace_generation": {
                "strategy": "CSV",
                "csv": {
                    "wide_or_long": "long",
                    # 20250202_DecanterData_REAL.csv heads its timestamp column
                    # "time"; the newer decanter_*.csv exports call the same
                    # column "TimeStamp". The name must match the file exactly.
                    "timestamp_column": "time",
                    "field_column": "DataObjectField",
                    "value_column": "Value",
                    "interpolate_method": "linear",
                    "bundle_all_csv": True,
                },
                "physics_constants": {"tolerances": {"ab": ab_range, "tr": tr_range}},
            },
        },
        aggregation=True,
    )


def main():
    made = []
    for v in range(1, 11):
        made.append(("thermo", f"THERMO_V{v}", thermo(v)))
    for v in (1, 2, 3, 4, 5):
        made.append(("hri", f"HRI_UPPAAL_V{v}", hri("UPPAAL", v)))
    for v in (1, 2, 3):
        made.append(("hri", f"HRI_SIM_V{v}", hri("SIM", v)))
    made.append(("energy", "ENERGY_V1_RANGE200",  energy("V1-RANGE200", 200)))
    made.append(("energy", "ENERGY_V2_RANGE1000", energy("V2-RANGE1000", 1000)))
    made.append(("energy", "ENERGY_V3_SIM",       energy("V3-SIM-PRESSURE", 200, pressure_exact=True)))
    made.append(("green",  "GREEN_V1",            green("V1")))
    made.append(("green",  "GREEN_V2_COARSE",     green("V2-COARSE", sp_range=10, t_range=5)))
    made.append(("green",  "GREEN_V3_REAL",       green_real()))

    for family, stem, doc in made:
        n_ev, n_mod = write(family, stem, doc)
        print(f"  {family:7s} {stem:22s} events={n_ev:3d} models={n_mod}")
    print(f"\n{len(made)} case-study definitions written under {HERE}")


if __name__ == "__main__":
    main()
