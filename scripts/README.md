# Data Pipeline — Scripts

## Quick Start

```bash
# 1. Set up the environment (from project root)
bash setup.sh
source venv/bin/activate

# 2. Place your raw data files in data/raw/
#      - amazon_products.csv    (Kaggle: Amazon Products Dataset 2023)
#      - amazon_reviews.csv     (Kaggle: Amazon Reviews 2023)
#      - amazon_categories.csv  (Category lookup table)

# 3. Fill in your RDS credentials in .env

# 4. Clean the data
python scripts/clean_data.py

# 5. Create the database and load data
python scripts/ingest_data.py
```

## What Each Script Does

| Script           | Purpose                                                        |
|------------------|----------------------------------------------------------------|
| `clean_data.py`  | Reads raw CSVs, cleans/deduplicates/type-casts, extracts brands, maps categories, filters orphan reviews, writes cleaned CSVs to `data/cleaned/` |
| `schema.sql`     | DDL to create all 5 tables with constraints and indexes        |
| `ingest_data.py` | Connects to RDS, runs DDL, bulk-loads cleaned CSVs via `COPY`, validates referential integrity, creates a read-only guest user |

## Output Files (data/cleaned/)

After running `clean_data.py`:

- `categories.csv` — from amazon_categories.csv (248 rows, original IDs preserved)
- `brands.csv` — extracted from product titles
- `products.csv` — cleaned product metadata with category_id and brand_id foreign keys
- `users.csv` — distinct user IDs from reviews
- `reviews.csv` — cleaned reviews linked to valid products and users
- `outliers.csv` — (if any) flagged rows for manual inspection

## Column Name Mapping

If your raw CSVs use different column headers than expected, edit the
`PRODUCT_COL_MAP` and `REVIEW_COL_MAP` dictionaries at the top of `clean_data.py`.
