# ENERGY-V1-RANGE200

Shipped `[ENERGY CS]` granularity (SPEED_RANGE = 200) -> 53 events. Slow: most bands never fire on this data.

## Files

- `ENERGY_V1_RANGE200.json` — the case-study definition
- `case_files/PowModel_Learning/PowModel_Learning/resources/traces/real/ENERGY/W7_2019-10-14_part0.csv` — input data (not copied: large / git-ignored)
- `case_files/PowModel_Learning/PowModel_Learning/resources/traces/real/ENERGY/W7_2019-10-14_part2.csv` — input data (not copied: large / git-ignored)
- `case_files/PowModel_Learning/PowModel_Learning/resources/traces/real/ENERGY/W7_2019-10-14_part3_0.csv` — input data (not copied: large / git-ignored)

## Configuration summary

| Field | Value |
|---|---|
| strategy | `CSV` |
| drivers | `RPM`, `PR` |
| estimated variable | `POWER` |
| events | 53 |
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
docker compose exec backend python case_files/case_studies/run_all.py --only ENERGY_V1_RANGE200
```
