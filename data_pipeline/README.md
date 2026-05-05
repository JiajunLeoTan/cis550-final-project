# Data Pipeline

This directory contains the Python scripts that transform raw Amazon CSV files
into normalized relational CSVs and load them into PostgreSQL.

The fuller code walkthrough is in
[`../docs/code_walkthrough.md`](../docs/code_walkthrough.md#data-pipeline).

## Files

- `clean_data.py` - Reads `data/raw/`, normalizes products/categories/reviews,
  extracts brands and users, filters reviews that do not link to a product, and
  writes cleaned CSVs to `data/cleaned/`.
- `ingest_data.py` - Runs `database/schema.sql`, loads cleaned CSVs with
  PostgreSQL `COPY`, validates foreign-key relationships, and creates the guest
  read-only database user.
- `create_guest_user.py` - Re-applies the guest role grants without reloading
  the database.

## Run Order

From the project root:

```bash
./venv/bin/pip install -r requirements.txt
./venv/bin/python data_pipeline/clean_data.py
./venv/bin/python data_pipeline/ingest_data.py
```

To refresh only the guest account:

```bash
./venv/bin/python data_pipeline/create_guest_user.py
```

To validate paths before opening a database connection:

```bash
./venv/bin/python data_pipeline/ingest_data.py --dry-run
```

## Inputs And Outputs

Expected raw files:

- `data/raw/amazon_products.csv`
- `data/raw/amazon_categories.csv`
- Review CSVs from the McAuley category streams, or the legacy
  `data/raw/amazon_reviews.csv` / `data/raw/Amazon_reviews_2023.csv`

Generated cleaned files:

- `data/cleaned/categories.csv`
- `data/cleaned/brands.csv`
- `data/cleaned/products.csv`
- `data/cleaned/users.csv`
- `data/cleaned/reviews.csv`
- `data/cleaned/outliers.csv`
