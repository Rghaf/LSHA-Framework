# GREEN-V2-COARSE

As v1 with wider bands (10 / 5) -> 10 events. Same data caveat as v1.

## Files

- `GREEN_V2_COARSE.json` — the case-study definition

## Configuration summary

| Field | Value |
|---|---|
| strategy | `CSV` |
| drivers | `sp`, `tmp` |
| estimated variable | `Ta` |
| events | 10 |
| flow conditions | 1 |
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
docker compose exec backend python case_files/case_studies/run_all.py --only GREEN_V2_COARSE
```
