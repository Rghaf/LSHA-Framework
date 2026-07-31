"""
generate_case_studies.py — derive the test-suite JSONs from the legacy SULs.

Every value written here is traceable to the original hard-coded case-study
implementations vendored under
``core_algorithm/lsha/sha_learning/case_studies/`` and to the reference
``sha_learning/resources/config/config.ini``. See
docs/CASE_STUDY_DEFINITIONS.md for the line-by-line derivation.

    python case_files/test_suite/generate_case_studies.py
"""

import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))

EMAIL = "reza.ghadiri.1998@gmail.com"

# ---------------------------------------------------------------------------
# Reference constants — sha_learning/resources/config/config.ini
# ---------------------------------------------------------------------------
# [LSHA PARAMETERS]
CFG_EQ_CONDITION  = "W"     # EQ_CONDITION = w
CFG_MI_QUERY      = False   # MI_QUERY = False
CFG_HT_QUERY      = True    # HT_QUERY = True
CFG_HT_QUERY_TYPE = "S"     # HT_QUERY_TYPE = S
CFG_N_MIN         = 1       # N_min = 1

# [ENERGY CS]
CFG_SPEED_RANGE = 200
CFG_MIN_SPEED   = 100
CFG_MAX_SPEED   = 10000

# Raw CSV column names in the W7/W8/W9 CNC exports.
COL_TS     = "TimestampUTC"
COL_ENERGY = "HEADSTOCK__SPINDLE_DRIVE___1___ENERGY"
COL_RPM    = "HEADSTOCK__SPINDLE_MOTOR___1___RPM"
COL_PRESS  = "RT__PALLET_LOCKING___1___PRESSURE"


def thermostat(version: int):
    """THERMO — case_studies/thermostat/{sul_definition,sul_functions}.py

    sul_definition.py:
        on_fc  = FlowCondition(0, on_model)   -> heating, exponential growth
        off_fc = FlowCondition(1, off_model)  -> cooling, exponential decay
        DRIVER_SIG = 't.ON'                   -> SINGLE driver, every version
        parse_data variables = ['t.ON', 'T_r', 'r.open']

    Events by CS_VERSION:
        [1]          -> Event('', 'on', 'h_0'), Event('', 'off', 'c_0')
        [2..10]      -> adds Event('open', 'on', 'h_1'), Event('open','off','c_1')
                        with the '!open' pair keeping h_0 / c_0.

    sul_functions.label_event, CS_VERSION in [2,4,5,6,7]:
        identified_guard = events[0].guard if wOpen == 1.0 else events[2].guard
        events[0].guard == '!open'  and  events[2].guard == 'open'
      => r.open == 1 selects the '!open' pair (h_0/c_0),
         r.open != 1 selects the 'open'  pair (h_1/c_1).
      This is inverted with respect to the variable's name; it is reproduced
      here verbatim so the JSON matches the reference implementation.
    """
    variables = [
        {"name": "T_r",    "source": "T_r",    "role": "estimated", "type": "REAL"},
        {"name": "t.ON",   "source": "t.ON",   "role": "driver",    "type": "INT"},
        # r.open is parsed by the legacy parse_data but is NOT in DRIVER_SIG.
        {"name": "r.open", "source": "r.open", "role": "context",   "type": "INT"},
    ]
    models = [
        {"id": 0, "name": "Heating (on_model, exp. growth)", "type": "EXP_GROWTH"},
        {"id": 1, "name": "Cooling (off_model, exp. decay)", "type": "EXP_DECAY"},
    ]

    if version == 1:
        events = [
            {"symbol": "h_0", "model_id": 0, "guard": "t.ON == 1"},
            {"symbol": "c_0", "model_id": 1, "guard": "t.ON == 0"},
        ]
    else:
        events = [
            {"symbol": "h_0", "model_id": 0, "guard": "t.ON == 1 and r.open == 1"},
            {"symbol": "c_0", "model_id": 1, "guard": "t.ON == 0 and r.open == 1"},
            {"symbol": "h_1", "model_id": 0, "guard": "t.ON == 1 and r.open != 1"},
            {"symbol": "c_1", "model_id": 1, "guard": "t.ON == 0 and r.open != 1"},
        ]

    return {
        "name": f"TS-THERMO-V{version}",
        "email": EMAIL,
        "resample_strategy": "UPPAAL",
        "driver_signal": ["t.ON"],
        "main_variable": "T_r",
        "context_variables": ["r.open"],
        "noise": 0.0,
        "n_min": CFG_N_MIN,
        "p_value": 0.05,
        "mi_query": CFG_MI_QUERY,
        "plot_ddtw": False,
        "ht_query": CFG_HT_QUERY,
        "ht_query_type": CFG_HT_QUERY_TYPE,
        "eq_condition": CFG_EQ_CONDITION,
        "is_aggregation": False,
        "user_json": {
            "case_study": "THERMO",
            "version": f"V{version}",
            "variables": variables,
            "models": models,
            "events": events,
            "constants": {},
            "trace_generation": {
                "strategy": "UPPAAL",
                "xml_force_variable": "force_open",
                "max_length": 15,
            },
        },
    }


def energy(tag, speed_range, min_speed=CFG_MIN_SPEED, max_speed=CFG_MAX_SPEED):
    """ENERGY — case_studies/energy/{sul_definition,sul_functions}.py

    sul_definition.py builds the alphabet exactly like this::

        for i in range(MIN_SPEED, MAX_SPEED, SPEED_RANGE):
            guard = '{i}<=w<{i+SPEED_RANGE}'   (last band: '{i}<=w')
            events.append(Event(guard, 'start', 'm_<n>'))
        events += [Event('', 'stop', 'i_0'),
                   Event('', 'load', 'l'), Event('', 'unload', 'u')]

    and uses a single flow condition ``pwr_model`` returning a constant, which
    maps to the dynamic schema's ``MEAN``.

    sul_functions.py:
        parse_data  : power = 60 * (e[i] - e[i-1]);  speed rounded to 100 and
                      clamped at 0;  columns are row[1..4] = timestamp,
                      energy, rpm, pressure.
        is_chg_pt   : abs(dw) > SPEED_RANGE or abs(dpr) > PR_RANGE
        label_event : pressure jump -> l / u
                      speed dropping below MIN_SPEED -> i_0
                      otherwise -> the m_<n> band containing the current speed
    """
    bands = []
    i = min_speed
    while i < max_speed:
        upper = i + speed_range
        idx = len(bands)
        if upper < max_speed:
            guard = f"{i} <= RPM and RPM < {upper}"
        else:
            guard = f"{i} <= RPM"
        bands.append({"symbol": f"m_{idx}", "model_id": 0, "guard": guard})
        i = upper

    # Guard order mirrors label_event's branch priority: pressure first, then
    # the spindle-stop test, then the speed bands.
    #
    # i_0's guard is deliberately broader than the legacy transition test
    # (`curr < MIN_SPEED and prev >= MIN_SPEED`). dynamic_sul returns the FIRST
    # declared event whenever no guard matches, so any sample the alphabet does
    # not cover is silently mislabelled as that event. Speeds below MIN_SPEED
    # belong to no band, and in this dataset ~70% of samples sit there — with a
    # transition-only i_0 every one of them fell through to the fallback and was
    # reported as a spurious `l` (load). Labelling the whole idle region as i_0
    # makes the alphabet total, so the fallback is unreachable.
    events = [
        {"symbol": "l",   "model_id": 0,
         "guard": f"math.fabs(PR - prev_PR) > {PR_RANGE} and PR > 500 and prev_PR <= 500"},
        {"symbol": "u",   "model_id": 0,
         "guard": f"math.fabs(PR - prev_PR) > {PR_RANGE}"},
        {"symbol": "i_0", "model_id": 0,
         "guard": f"RPM < {min_speed}"},
    ] + bands

    return {
        "name": f"TS-ENERGY-{tag}",
        "email": EMAIL,
        "resample_strategy": "CSV",
        "driver_signal": ["RPM", "PR"],
        "main_variable": "POWER",
        "context_variables": [],
        "noise": 0.0,
        "n_min": CFG_N_MIN,
        "p_value": 0.05,
        "mi_query": CFG_MI_QUERY,
        "plot_ddtw": False,
        "ht_query": CFG_HT_QUERY,
        "ht_query_type": CFG_HT_QUERY_TYPE,
        "eq_condition": CFG_EQ_CONDITION,
        "is_aggregation": True,
        "user_json": {
            "case_study": "ENERGY",
            "version": tag,
            "variables": [
                {"name": "POWER", "source": "POWER_kW", "role": "estimated", "type": "REAL"},
                {"name": "RPM",   "source": COL_RPM,    "role": "driver",    "type": "REAL"},
                {"name": "PR",    "source": COL_PRESS,  "role": "driver",    "type": "REAL"},
            ],
            # pwr_model returns a constant -> MEAN
            "models": [{"id": 0, "name": "Spindle power (pwr_model)", "type": "MEAN"}],
            "events": events,
            "constants": {
                "MIN_SPEED": min_speed,
                "MAX_SPEED": max_speed,
                "SPEED_RANGE": speed_range,
                "PR_RANGE": PR_RANGE,
            },
            "trace_generation": {
                "strategy": "CSV",
                "csv": {
                    "wide_or_long": "wide",
                    "timestamp_column": COL_TS,
                    "interpolate_method": "ffill",
                    # power = 60 * d/dt(energy), as in parse_data
                    "derive_columns": {
                        COL_ENERGY: {"factor": 60, "target": "POWER_kW"}
                    },
                    # speed rounded to the closest 100, as in parse_data
                    "round_columns": {COL_RPM: 100},
                },
                "physics_constants": {
                    # is_chg_pt thresholds
                    "tolerances": {"RPM": speed_range, "PR": PR_RANGE}
                },
            },
        },
    }


PR_RANGE = 500  # config.ini [ENERGY CS] PR_RANGE


def main():
    out = {
        "TS_THERMO_V1": thermostat(1),
        "TS_THERMO_V5": thermostat(5),
        # The legacy ENERGY case study is parameterised entirely through
        # config.ini's [ENERGY CS] block, so the two "versions" differ exactly
        # in that block: the shipped 200-RPM granularity, and a coarser
        # 1000-RPM one.
        "TS_ENERGY_V1": energy("V1-RANGE200", CFG_SPEED_RANGE),
        "TS_ENERGY_V2": energy("V2-RANGE1000", 1000),
    }
    for stem, cfg in out.items():
        path = os.path.join(HERE, f"{stem}.json")
        with open(path, "w") as fh:
            json.dump(cfg, fh, indent=2)
            fh.write("\n")
        n_events = len(cfg["user_json"]["events"])
        print(f"wrote {stem}.json  events={n_events}")


if __name__ == "__main__":
    main()
