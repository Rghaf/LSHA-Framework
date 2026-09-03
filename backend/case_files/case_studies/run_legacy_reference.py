"""
run_legacy_reference.py — run the ORIGINAL L*SHA algorithm, unmodified.

This drives the vendored upstream package (`core_algorithm/lsha`) directly:
its own SUL definitions, its own Teacher, Learner and ObsTable. None of the
platform's dynamic code (`dynamic_sul.py`, `teacher.py`, `dynamic_obstable.py`,
`dynamic_tracegenerator.py`) is involved, so the output is a reference to
compare the platform against.

It mirrors `sha_learning/learn_model.py` but imports only the case study being
run — `learn_model.py` imports every case study at module scope, which drags in
Neo4j (auto_twin) and pygad (energy) for no reason.

The upstream package reads all of its settings from
`sha_learning/resources/config/config.ini`, so this script writes that file
before importing anything from the package. The vendored copy is left untouched:
everything happens in a scratch copy passed via --workdir.

    python case_files/case_studies/run_legacy_reference.py --case THERMO --version 1
    python case_files/case_studies/run_legacy_reference.py --case HRI    --version 1
"""

import argparse
import configparser
import json
import os
import shutil
import subprocess
import sys
from datetime import datetime


def build_workdir(src, workdir):
    """Copy the upstream package into a scratch dir so config.ini can be edited."""
    if os.path.isdir(workdir):
        shutil.rmtree(workdir)
    os.makedirs(os.path.dirname(workdir), exist_ok=True)
    shutil.copytree(src, workdir, symlinks=True,
                    ignore=shutil.ignore_patterns('.git', '__pycache__'))
    # The upstream repo keeps config.ini under sha_learning/resources/ but the
    # UPPAAL models, scripts and output dirs under a separate root-level
    # resources/. Both are needed.
    for sub in ('resources/upp_results', 'resources/learned_sha', 'resources/traces'):
        os.makedirs(os.path.join(workdir, sub), exist_ok=True)
    return workdir


def write_config(workdir, case, version, strategy, uppaal_bin_dir,
                 eq_condition, n_min, ht_query_type, p_delta, mi_query,
                 model_override=None, query_override=None):
    """Point config.ini at this machine and select the case study/version."""
    cfg_path = os.path.join(workdir, 'sha_learning/resources/config/config.ini')
    cfg = configparser.ConfigParser()
    cfg.optionxform = str
    cfg.read(cfg_path)

    # config.ini is resolved by the package as <root>/sha_learning/resources/...
    cfg_res = os.path.join(workdir, 'sha_learning/resources')
    # everything else (models, scripts, outputs) lives in <root>/resources/
    res = os.path.join(workdir, 'resources')
    upp = os.path.join(res, 'uppaal_resources')

    model = 'thermostat.xml' if case == 'THERMO' else 'hri-w_ref.xml'
    query = 'thermostat.q' if case == 'THERMO' else f'hri-w_ref{version}.q'
    model_path = os.path.join(upp, model)
    query_path = os.path.join(upp, query)
    # The upstream HRI model declares `const double INT16_MAX`, which UPPAAL 5.0
    # now provides as a builtin -> "Duplicate definition of INT16_MAX" and an
    # empty trace. The copy in case_files/ has that line commented out, so allow
    # pointing at a working model. Using the same model the platform uses also
    # keeps the comparison apples-to-apples.
    if model_override:
        model_path = model_override
    if query_override:
        query_path = query_override

    cfg['SUL CONFIGURATION']['CASE_STUDY'] = case
    cfg['SUL CONFIGURATION']['CS_VERSION'] = str(version)
    cfg['SUL CONFIGURATION']['RESAMPLE_STRATEGY'] = strategy
    cfg['SUL CONFIGURATION']['SHA_SAVE_PATH'] = os.path.join(res, 'learned_sha') + '/'
    cfg['SUL CONFIGURATION']['REPORT_SAVE_PATH'] = os.path.join(res, 'learned_sha') + '/'

    cfg['TRACE GENERATION']['UPPAAL_PATH'] = uppaal_bin_dir
    cfg['TRACE GENERATION']['UPPAAL_SCRIPT_PATH'] = os.path.join(res, 'scripts/verify.sh')
    cfg['TRACE GENERATION']['UPPAAL_MODEL_PATH'] = model_path
    cfg['TRACE GENERATION']['UPPAAL_QUERY_PATH'] = query_path
    cfg['TRACE GENERATION']['UPPAAL_OUT_PATH'] = os.path.join(res, 'upp_results', '{}.txt')
    cfg['TRACE GENERATION']['SIM_LOGS_PATH'] = os.path.join(res, 'traces', '{}', '{}')

    cfg['LSHA PARAMETERS']['MI_QUERY'] = mi_query
    cfg['LSHA PARAMETERS']['EQ_CONDITION'] = eq_condition
    cfg['LSHA PARAMETERS']['N_min'] = str(n_min)
    cfg['LSHA PARAMETERS']['HT_QUERY_TYPE'] = ht_query_type
    cfg['LSHA PARAMETERS']['DELTA'] = str(p_delta)
    cfg['DEFAULT']['PLOT_DISTR'] = 'False'      # no display inside a container

    with open(cfg_path, 'w') as fh:
        cfg.write(fh)

    os.chmod(os.path.join(res, 'scripts/verify.sh'), 0o755)
    return cfg_path


CHILD = r'''
import os, sys, warnings, json
from datetime import datetime
warnings.filterwarnings('ignore')

WORKDIR, CASE, VERSION, OUT = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4]
sys.path.insert(0, WORKDIR)
# trace_gen.py imports skg_main at module scope even for UPPAAL runs, so the
# sibling vendored packages must be importable too (same as tasks.py does).
for _sib in ('skg_connector', 'autotwin_automata_learning', 'sha2dt_semantic_mapper'):
    _p = os.path.join('/app/core_algorithm', _sib)
    if os.path.isdir(_p):
        sys.path.insert(0, _p)

from sha_learning.domain.lshafeatures import Trace
from sha_learning.domain.obstable import ObsTable
from sha_learning.learning_setup.learner import Learner
from sha_learning.learning_setup.teacher import Teacher
import sha_learning.pltr.lsha_report as report

if CASE == 'THERMO':
    from sha_learning.case_studies.thermostat.sul_definition import thermostat_cs as SUL
else:
    from sha_learning.case_studies.hri.sul_definition import hri_cs as SUL

start = datetime.now()
TEACHER = Teacher(SUL)
long_traces = [Trace(events=[e]) for e in SUL.events]
obs_table = ObsTable([], [Trace(events=[])], long_traces)
LEARNER = Learner(TEACHER, obs_table)
LEARNED_HA = LEARNER.run_lsha(filter_empty=True)

# Mirror learn_model.py's reporting, minus the graphviz viewer.
name = '{}_{}'.format(CASE, VERSION)
save_dir = os.path.join(WORKDIR, 'resources/learned_sha') + '/'
report.save_data(TEACHER.symbols, TEACHER.distributions, LEARNER.obs_table,
                 len(TEACHER.signals), datetime.now() - start, name, None, save_dir)

distr = []
for v in SUL.vars:
    for d in v.distr:
        distr.append({'id': d.d_id, 'params': {k: float(x) for k, x in d.params.items()}})
json.dump({
    'case': CASE, 'version': VERSION,
    'symbols': [str(s) for s in TEACHER.symbols],
    'n_traces': len(TEACHER.signals),
    'distributions': distr,
    'report': os.path.join(save_dir, name + '.txt'),
    'seconds': (datetime.now() - start).total_seconds(),
}, open(OUT, 'w'), indent=2)
print('LEGACY RUN OK ->', OUT)
'''


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--case', choices=['THERMO', 'HRI'], required=True)
    ap.add_argument('--version', default='1')
    ap.add_argument('--strategy', default='UPPAAL')
    ap.add_argument('--uppaal-bin-dir', default='/opt/uppaal/lib/app/bin')
    ap.add_argument('--model', help='override the UPPAAL .xml')
    ap.add_argument('--query', help='override the UPPAAL .q')
    ap.add_argument('--mi-query', default='False', choices=['True', 'False'])
    ap.add_argument('--eq-condition', default='w')
    ap.add_argument('--n-min', default='1')
    ap.add_argument('--ht-query-type', default='S')
    ap.add_argument('--delta', default='1.0')
    ap.add_argument('--src', default='/app/core_algorithm/lsha')
    ap.add_argument('--workdir', default='/tmp/legacy-lsha')
    ap.add_argument('--out-dir', default='/app/case_files/case_studies/results/legacy')
    args = ap.parse_args()

    wd = build_workdir(args.src, args.workdir)
    write_config(wd, args.case, args.version, args.strategy, args.uppaal_bin_dir,
                 args.eq_condition, args.n_min, args.ht_query_type, args.delta,
                 args.mi_query, args.model, args.query)

    os.makedirs(args.out_dir, exist_ok=True)
    tag = f'{args.case}_V{args.version}' + ('_MI' if args.mi_query == 'True' else '')
    out = os.path.join(args.out_dir, f'legacy_{tag}.json')

    child = os.path.join(wd, '_run_child.py')
    with open(child, 'w') as fh:
        fh.write(CHILD)

    # Run in a subprocess: the upstream package reads config.ini at import time,
    # so each configuration needs a fresh interpreter.
    rc = subprocess.call([sys.executable, child, wd, args.case, str(args.version), out],
                         cwd=wd)
    if rc != 0:
        sys.exit(f'legacy run failed (exit {rc})')

    data = json.load(open(out))
    print(f"\ncase={data['case']} V{data['version']}  traces={data['n_traces']}  "
          f"symbols={len(data['symbols'])}  distributions={len(data['distributions'])}  "
          f"{data['seconds']:.1f}s")
    for d in data['distributions']:
        print(f"   D_{d['id']}: {d['params']}")


if __name__ == '__main__':
    main()
