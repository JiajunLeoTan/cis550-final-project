"""
CIS 5500 — Data-Driven Shopping Assistant
Database Ingestion Script

Usage:
    1. Fill in your .env file with RDS credentials.
    2. Run the cleaning script first:  python scripts/clean_data.py
    3. Run this script:                python scripts/ingest_data.py

This script:
    - Connects to your PostgreSQL instance on AWS RDS
    - Creates all tables (runs schema.sql)
    - Loads cleaned CSVs in dependency order using COPY for speed
    - Validates row counts after loading
"""

import os
import sys
import csv
import time
import psycopg2
from psycopg2 import sql
from dotenv import load_dotenv

load_dotenv()

# ---------------------------------------------------------------------------
# CONFIGURATION
# ---------------------------------------------------------------------------
DB_CONFIG = {
    "host": os.getenv("DB_HOST", "localhost"),
    "port": os.getenv("DB_PORT", "5432"),
    "dbname": os.getenv("DB_NAME", "shopping_assistant"),
    "user": os.getenv("DB_USER", "postgres"),
    "password": os.getenv("DB_PASSWORD", ""),
}

CLEAN_DIR = os.path.join("data", "cleaned")
SCHEMA_FILE = os.path.join("scripts", "schema.sql")

# Tables in dependency order: parent tables first
TABLES = [
    {
        "name": "Categories",
        "file": "categories.csv",
        "columns": ["category_id", "category_name"],
    },
    {
        "name": "Brands",
        "file": "brands.csv",
        "columns": ["brand_id", "brand_name"],
    },
    {
        "name": "Products",
        "file": "products.csv",
        "columns": [
            "asin", "title", "img_url", "product_url",
            "price", "list_price", "stars", "review_count",
            "is_best_seller", "bought_in_last_month",
            "category_id", "brand_id",
        ],
    },
    {
        "name": "Users",
        "file": "users.csv",
        "columns": ["user_id"],
    },
    {
        "name": "Reviews",
        "file": "reviews.csv",
        "columns": [
            "review_id", "asin", "user_id", "rating",
            "review_title", "review_text", "helpful_vote",
            "verified_purchase", "review_timestamp",
        ],
    },
]


# ---------------------------------------------------------------------------
# HELPERS
# ---------------------------------------------------------------------------
def get_connection():
    """Create and return a database connection."""
    print(f"Connecting to {DB_CONFIG['host']}:{DB_CONFIG['port']}/{DB_CONFIG['dbname']}...")
    conn = psycopg2.connect(**DB_CONFIG)
    conn.autocommit = False
    return conn


def run_schema(conn):
    """Execute the DDL script to create/recreate all tables."""
    print("\nRunning schema.sql...")
    with open(SCHEMA_FILE, "r") as f:
        ddl = f.read()
    with conn.cursor() as cur:
        cur.execute(ddl)
    conn.commit()
    print("  Schema created successfully.")


def load_table(conn, table_info):
    """Load a single CSV into the corresponding table using COPY."""
    name = table_info["name"]
    filepath = os.path.join(CLEAN_DIR, table_info["file"])
    columns = table_info["columns"]

    if not os.path.exists(filepath):
        print(f"Missing file: {filepath} — skipping {name}")
        return 0

    print(f"\n  Loading {name} from {filepath}...")
    start = time.time()

    with conn.cursor() as cur:
        # Use COPY for fast bulk loading
        with open(filepath, "r", encoding="utf-8") as f:
            # Skip the header row
            next(f)
            cur.copy_expert(
                sql.SQL("COPY {} ({}) FROM STDIN WITH (FORMAT CSV, NULL '')").format(
                    sql.Identifier(name.lower()),
                    sql.SQL(", ").join(sql.Identifier(c) for c in columns),
                ),
                f,
            )
    conn.commit()

    # Get row count
    with conn.cursor() as cur:
        cur.execute(sql.SQL("SELECT COUNT(*) FROM {}").format(sql.Identifier(name.lower())))
        count = cur.fetchone()[0]

    elapsed = time.time() - start
    print(f"  ✓ {name}: {count:,} rows loaded in {elapsed:.1f}s")
    return count


def validate(conn):
    """Run basic validation queries after loading."""
    print("\n=== Validation ===")
    checks = [
        ("Orphan products (bad category_id)",
         """SELECT COUNT(*) FROM products p
            WHERE p.category_id IS NOT NULL
              AND p.category_id NOT IN (SELECT category_id FROM categories)"""),
        ("Orphan products (bad brand_id)",
         """SELECT COUNT(*) FROM products p
            WHERE p.brand_id IS NOT NULL
              AND p.brand_id NOT IN (SELECT brand_id FROM brands)"""),
        ("Orphan reviews (bad asin)",
         """SELECT COUNT(*) FROM reviews r
            WHERE r.asin NOT IN (SELECT asin FROM products)"""),
        ("Orphan reviews (bad user_id)",
         """SELECT COUNT(*) FROM reviews r
            WHERE r.user_id NOT IN (SELECT user_id FROM users)"""),
    ]
    with conn.cursor() as cur:
        all_ok = True
        for label, query in checks:
            cur.execute(query)
            n = cur.fetchone()[0]
            status = "✓" if n == 0 else "⚠"
            if n > 0:
                all_ok = False
            print(f"  {status} {label}: {n}")

    if all_ok:
        print("\n  All validation checks passed!")
    else:
        print("\n  Some checks failed — inspect the data above.")


def create_guest_user(conn):
    """Create a read-only guest account for Milestone 3 submission."""
    guest_user = os.getenv("GUEST_USER", "guest")
    guest_pass = os.getenv("GUEST_PASSWORD", "changeme")
    db_name = DB_CONFIG["dbname"]

    print(f"\n=== Creating guest user: {guest_user} ===")
    conn.autocommit = True
    with conn.cursor() as cur:
        # Drop if exists, then recreate
        cur.execute(sql.SQL("DROP ROLE IF EXISTS {}").format(sql.Identifier(guest_user)))
        cur.execute(
            sql.SQL("CREATE ROLE {} WITH LOGIN PASSWORD %s").format(sql.Identifier(guest_user)),
            [guest_pass],
        )
        cur.execute(
            sql.SQL("GRANT CONNECT ON DATABASE {} TO {}").format(
                sql.Identifier(db_name), sql.Identifier(guest_user)
            )
        )
        cur.execute(
            sql.SQL("GRANT USAGE ON SCHEMA public TO {}").format(sql.Identifier(guest_user))
        )
        cur.execute(
            sql.SQL("GRANT SELECT ON ALL TABLES IN SCHEMA public TO {}").format(
                sql.Identifier(guest_user)
            )
        )
    conn.autocommit = False
    print(f"  Guest user '{guest_user}' created with read-only access.")
    print(f"  Include these credentials in your Milestone 3 submission.")


# ---------------------------------------------------------------------------
# MAIN
# ---------------------------------------------------------------------------
def main():
    print("=" * 60)
    print("  CIS 5500 — Database Ingestion Pipeline")
    print("=" * 60)

    # Verify cleaned files exist
    for t in TABLES:
        path = os.path.join(CLEAN_DIR, t["file"])
        if not os.path.exists(path):
            print(f"\n Missing: {path}")
            print(f"   Run  python scripts/clean_data.py  first.")
            sys.exit(1)

    conn = get_connection()

    try:
        # 1. Create schema
        run_schema(conn)

        # 2. Load tables in order
        print("\n=== Loading Data ===")
        total_start = time.time()
        total_rows = 0
        for table in TABLES:
            total_rows += load_table(conn, table)

        total_elapsed = time.time() - total_start
        print(f"\n  Total: {total_rows:,} rows loaded in {total_elapsed:.1f}s")

        # 3. Validate
        validate(conn)

        # 4. Create guest user
        create_guest_user(conn)

    except Exception as e:
        conn.rollback()
        print(f"\n Error: {e}")
        raise
    finally:
        conn.close()
        print("\nConnection closed. Done!")


if __name__ == "__main__":
    main()
