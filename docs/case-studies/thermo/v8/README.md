# THERMO-V8

No UPPAAL model for this version is present in the repository, so the definition cannot be run as-is. Supply a `thermostat-v8.xml` built for this alphabet to use it.

## Files

- `THERMO_V8.json` — the case-study definition

## Configuration summary

| Field | Value |
|---|---|
| strategy | `UPPAAL` |
| drivers | `t.ON` |
| estimated variable | `T_r` |
| events | 6 |
| flow conditions | 4 |
| `mi_query` | `false` |
| `default_model_id` | `1` |
| `ht_sample_mode` | `raw` |
| trace seed | `42` — verifyta is given `-r 42`, so repeated runs sample identical traces |

## Running it

`verifyta` segfaults inside a container, so the host-side bridge has to be
running alongside the stack:

```bash
docker compose up -d
./uppaal-bridge/run-bridge.sh
```

Submit the definition — `POST /api/case-study/` with these JSON fields
— then trigger `POST /run/`. The bundled harness does all of that:

```bash
docker compose exec backend python case_files/case_studies/run_all.py --only THERMO_V8
```
