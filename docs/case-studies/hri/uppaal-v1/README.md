# HRI-UPPAAL-V1

## Files

- `HRI_UPPAAL_V1.json` — the case-study definition
- `hri-w_ref-V1.xml` — UPPAAL model
- `hri-w_ref1.q` — UPPAAL query

## Configuration summary

| Field | Value |
|---|---|
| strategy | `UPPAAL` |
| drivers | `busy` |
| estimated variable | `F` |
| events | 2 |
| flow conditions | 2 |
| `mi_query` | `false` |
| `default_model_id` | `0` |
| `ht_sample_mode` | `replicated` |
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
docker compose exec backend python case_files/case_studies/run_all.py --only HRI_UPPAAL_V1
```
