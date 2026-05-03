# Axiom Shopping Assistant

Axiom is a CIS 5500 final project for exploring Amazon product data with a
shopping-assistant workflow. Users can search products, inspect product detail
and review signals, compare alternatives, estimate cart savings, and explore
category, brand, trend, and value-ranking analytics.

The app is organized as a React/Vite frontend, an Express API, and a PostgreSQL
database loaded from cleaned Amazon product, review, category, brand, and user
CSV files.

## Stack

- Frontend: React, Vite, React Router, custom SVG charts
- Backend: Node.js, Express, `pg`
- Database: PostgreSQL on AWS RDS
- Data tooling: Python, pandas, psycopg2, Jupyter
- Benchmarking: `EXPLAIN ANALYZE` scripts with JSON and Markdown outputs

## Dataset

Raw files live in `data/raw/`. Cleaned relational CSVs are generated into
`data/cleaned/` by `data_pipeline/clean_data.py`.

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
product table, and writes the normalized tables used by the API. The current raw
review file is broader than the product file, so many review ASINs are filtered
because no matching product is present.

## Directory Map

```text
.
|-- client/              React/Vite frontend app and client-specific README
|-- data/                Raw and cleaned CSV inputs for the database
|-- data_pipeline/       Python cleaning, ingestion, and guest-user scripts
|-- database/            Schema, performance DDL, and materialized-view refresh SQL
|-- docs/                Final report, slides, demo script, ER diagram, timings
|-- docs/benchmarks/     Benchmark JSON outputs and captured EXPLAIN plans
|-- docs/planning/       Working notes kept for project history
|-- docs/reference/      Course rubric and guideline PDFs
|-- notebooks/           EDA notebook used for milestone evidence
|-- scripts/             Operational Node.js utilities for benchmarks and refreshes
|-- server/              Express API, routes, config, DB pool, cache, and SQL modules
|-- .env.example         Backend environment variable template
|-- requirements.txt     Python data and notebook dependencies
`-- package.json         Root backend dependency and script manifest
```

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
database/schema.sql + data/cleaned/*.csv
```

See `docs/er_diagram.svg` for the database ER diagram, `server/README.md` for
the API route list, and `client/README.md` for the page-by-page frontend
structure.

## Run Locally

Install backend dependencies from the project root:

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

Install Python dependencies:

```bash
./venv/bin/pip install -r requirements.txt
```

Clean raw CSVs:

```bash
./venv/bin/python data_pipeline/clean_data.py
```

Load PostgreSQL:

```bash
./venv/bin/python data_pipeline/ingest_data.py
```

Create or refresh the read-only guest user:

```bash
./venv/bin/python data_pipeline/create_guest_user.py
```

## Database Maintenance

The optimized analytics and value-ranking routes read from PostgreSQL
materialized views. Refresh them after re-ingesting data, or on a scheduled
deployment job:

```bash
node scripts/refresh_matviews.js
```

Performance DDL lives in `database/perf_ddl.sql`; the clean bootstrap schema
lives in `database/schema.sql`.

## Benchmarks

Run query timing benchmarks from the project root:

```bash
node scripts/benchmark.js --phase pre-index
# apply/rebuild schema indexes, then:
node scripts/benchmark.js --phase post-index --baseline pre-index
```

Benchmark output is written to `docs/benchmarks/` and `docs/timings.md`.

## API

The server exposes the 15 Milestone 4 routes documented in `server/README.md`.
Every route preserves the optimized query-mode contract:

```text
?optimized=0  original query path
?optimized=1  optimized query path
```

## Deliverables

- Final report source: `docs/final_report.tex`
- Slides: `docs/slides.md` and `docs/slides.pdf`
- Demo script: `docs/demo_script.md`
- ER diagram: `docs/er_diagram.svg` and `docs/er_diagram.png`
- API spec: `docs/api_spec.pdf`
- Performance timings: `docs/timings.md`
- EDA evidence: `notebooks/eda.ipynb`

## Deployment

Live URL: TBD after deployment.

Recommended deployment split:

- Backend: Render or Fly.io with the root `.env` variables configured.
- Frontend: Vercel with `VITE_API_BASE_URL` set to the deployed backend URL.
- Database: AWS RDS PostgreSQL with schema, indexes, materialized views, and
  cleaned CSVs loaded through the data pipeline.

## Group Members

Chenguang Shen
Luis Garcia
Leo Tan
Anika Madan
