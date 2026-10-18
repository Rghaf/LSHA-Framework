# HRI-SIM-V3

Simulator-driven variant. Needs `humanFatigue.log` / `humanPosition.log` converted to a wide CSV with a pre-computed `moving` column; those logs are not in the repository.

## Files

- `HRI_SIM_V3.json` — the case-study definition

## Configuration summary

| Field | Value |
|---|---|
| strategy | `CSV` |
| drivers | `busy` |
| estimated variable | `F` |
| events | 6 |
| flow conditions | 2 |
| `mi_query` | `false` |
| `default_model_id` | `0` |
| `ht_sample_mode` | `replicated` |
| trace seed | n/a — traces are read from the CSVs, so runs are already reproducible |

## Running it

```bash
docker compose up -d
```

Submit the definition — `POST /api/case-study/` with these JSON fields
— then trigger `POST /run/`. The bundled harness does all of that:

```bash
docker compose exec backend python case_files/case_studies/run_all.py --only HRI_SIM_V3
```
