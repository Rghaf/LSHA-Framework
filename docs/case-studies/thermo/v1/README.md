# THERMO-V1

## Files

- `THERMO_V1.json` — the case-study definition
- `thermostat-v1.xml` — UPPAAL model
- `thermostat.q` — UPPAAL query

## Configuration summary

| Field | Value |
|---|---|
| strategy | `UPPAAL` |
| drivers | `t.ON` |
| estimated variable | `T_r` |
| events | 2 |
| flow conditions | 2 |
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

Submit the definition — `POST /api/case-study/` with these JSON fields, attaching the `.xml` and `.q` above as `uppaal_model_file`
and `uppaal_query_file`
— then trigger `POST /run/`. The bundled harness does all of that:

```bash
docker compose exec backend python case_files/case_studies/run_all.py --only THERMO_V1
```
