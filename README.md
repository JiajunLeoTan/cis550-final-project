# Axiom Shopping Assistant

Axiom is a CIS 5500 final project for exploring Amazon product data with a
PostgreSQL-backed recommendation and analytics workflow. The app combines a
React/Vite frontend, an Express API, and an AWS RDS PostgreSQL database loaded
from cleaned Kaggle-style Amazon product, category, and review CSVs.

## Dataset

Raw files live under `data/raw/` and cleaned files are generated into
`data/cleaned/` by `scripts/clean_data.py`.

| Dataset | Source file | Current raw rows | Current cleaned rows |
|---|---:|---:|---:|
| Products | `amazon_products.csv` | 1,426,337 | 1,426,336 |
| Reviews | `amazon_reviews.csv` | 701,528 | 11,927 linked reviews |
| Categories | `amazon_categories.csv` | 248 | 248 |
| Brands | extracted from product titles | n/a | 26,484 |
| Users | extracted from linked reviews | n/a | 11,902 |

The cleaner deduplicates products by ASIN, normalizes category foreign keys,
extracts canonical brand entities from product titles, drops rare brand
singletons to `NULL brand_id`, filters reviews to products present in the
product table, and writes the five relational tables used by the API. The
current raw review file is much broader than the products file: 689,477 raw
reviews do not have a matching product ASIN/parent ASIN in this corpus, so a
larger final review table requires a matching product/review source pair.

## Architecture

```text
client/ React + Vite SPA
   |
   | HTTP, query-mode flag (?optimized=1)
   v
server/ Express routes
   |
   | pg Pool
   v
AWS RDS PostgreSQL
   |
   v
scripts/schema.sql + data/cleaned/*.csv
```

See `docs/er_diagram.svg` for the database ER diagram and `client/README.md`
for the page-by-page frontend structure.

## Run Locally

Install root backend dependencies:

```bash
npm install
cp .env.example .env
```

Fill `.env` with PostgreSQL credentials, then start the API:

```bash
npm run dev
```

In a second terminal, start the frontend:

```bash
cd client
npm install
npm run dev
```

The backend defaults to `http://localhost:8080`; the frontend defaults to
`http://localhost:5173`. To point the client at another backend, create
`client/.env.local` with `VITE_API_BASE_URL=https://your-backend-host`.

## Data Pipeline

Clean raw CSVs:

```bash
./venv/bin/python scripts/clean_data.py
```

Load PostgreSQL:

```bash
./venv/bin/python scripts/ingest_data.py
```

Run query timing benchmarks:

```bash
node scripts/benchmark.js --phase pre-index
# apply/rebuild schema indexes, then:
node scripts/benchmark.js --phase post-index --baseline pre-index
```

Benchmark output is written to `docs/benchmarks/` and `docs/timings.md`.

## Maintenance

The optimized analytics and value-ranking routes read from PostgreSQL
materialized views. Refresh them after re-ingesting data, or on a nightly
schedule for a deployed app:

```bash
node scripts/refresh_matviews.js
```

## API

The server exposes the 15 Milestone 4 routes documented in `server/README.md`.
Every route preserves the optimized query-mode contract:

```text
?optimized=0  original query path
?optimized=1  optimized query path
```

## Deployment

Live URL: TBD after deployment.

Recommended deployment split:

- Backend: Render or Fly.io with the root `.env` variables configured.
- Frontend: Vercel with `VITE_API_BASE_URL` set to the deployed backend URL.
