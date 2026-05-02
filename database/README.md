# Database Assets

This directory contains the SQL files needed to create, optimize, and maintain
the PostgreSQL database used by Axiom.

## Files

- `schema.sql` - Full bootstrap schema for a clean database. It drops and
  recreates the five normalized relations (`Categories`, `Brands`, `Products`,
  `Users`, `Reviews`), core indexes, optimization indexes, and materialized
  views.
- `perf_ddl.sql` - Standalone performance DDL used during Milestone 5
  optimization. It is useful when applying or rebuilding indexes and
  materialized views on an already-loaded database.
- `refresh_matviews.sql` - Refreshes the materialized views consumed by the
  optimized analytics, trending, and value-ranking routes.

## Schema Notes

The design keeps product, category, brand, user, and review facts in separate
relations:

- `Products.category_id` references `Categories.category_id`.
- `Products.brand_id` references `Brands.brand_id` and is nullable for rare or
  unrecognized brands.
- `Reviews.asin` references `Products.asin`.
- `Reviews.user_id` references `Users.user_id`.

This keeps repeated category, brand, and user attributes out of the product and
review rows, which supports the 3NF justification in the final report.

## Maintenance

After a reload or bulk data change, refresh materialized views from the project
root:

```bash
node scripts/refresh_matviews.js
```

For a fresh database load, use the ingestion pipeline:

```bash
./venv/bin/python data_pipeline/ingest_data.py
```
