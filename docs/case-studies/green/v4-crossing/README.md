# GREEN-V4-CROSSING

As v3-real but with band-crossing guards, so the second driver's events become reachable. Larger alphabet; may not converge quickly.

## Files

- `GREEN_V4_CROSSING.json` — the case-study definition
- `case_files/OldData/20250202_DecanterData_REAL.csv` — input data (not copied: large / git-ignored)

## Configuration summary

| Field | Value |
|---|---|
| strategy | `CSV` |
| drivers | `ab`, `tr` |
| estimated variable | `Ta` |
| events | 9 |
| flow conditions | 1 |
| `mi_query` | `false` |
| `default_model_id` | `0` |
| `ht_sample_mode` | `replicated` |
| trace seed | n/a — traces are read from the CSVs, so runs are already reproducible |

## Running it

```bash
docker compose up -d
```

Submit the definition — `POST /api/case-study/` with these JSON fields, then upload the input CSVs to
`POST /api/csv-files/` with `case_study=<id>`
— then trigger `POST /run/`. The bundled harness does all of that:

```bash
docker compose exec backend python case_files/case_studies/run_all.py --only GREEN_V4_CROSSING
```
