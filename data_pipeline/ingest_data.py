"""
Load the cleaned CSV tables into PostgreSQL.

Run the cleaner first, then run this script from the project root:
    python data_pipeline/clean_data.py
    python data_pipeline/ingest_data.py

Use --dry-run to check that schema.sql and the cleaned CSVs exist without
opening a database connection.
"""

import os
import sys
import csv
import time
import psycopg2
from psycopg2 import sql
from dotenv import load_dotenv

load_dotenv()

# Database connection and file locations.
DB_CONFIG = {
    "host": os.getenv("DB_HOST", "localhost"),
    "port": os.getenv("DB_PORT", "5432"),
    "dbname": os.getenv("DB_NAME", "shopping_assistant"),
    "user": os.getenv("DB_USER", "postgres"),
    "password": os.getenv("DB_PASSWORD", ""),
}

CLEAN_DIR = os.path.join("data", "cleaned")
SCHEMA_FILE = os.path.join("database", "schema.sql")

# Parent tables load first so foreign keys are satisfied when products/reviews
# are copied in.
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
            "is_best_seller",
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


def get_connection():
    """Open a PostgreSQL connection using the credentials from .env."""
    print(f"Connecting to {DB_CONFIG['host']}:{DB_CONFIG['port']}/{DB_CONFIG['dbname']}...")
    conn = psycopg2.connect(**DB_CONFIG)
    conn.autocommit = False
    return conn


def run_schema(conn):
    """Apply schema.sql before loading fresh data."""
    print("\nRunning database/schema.sql...")
    with open(SCHEMA_FILE, "r") as f:
        ddl = f.read()
    with conn.cursor() as cur:
        cur.execute(ddl)
    conn.commit()
    print("  Schema created successfully.")


def load_table(conn, table_info):
    """COPY one cleaned CSV into its matching table and return its row count."""
    name = table_info["name"]
    filepath = os.path.join(CLEAN_DIR, table_info["file"])
    columns = table_info["columns"]

    if not os.path.exists(filepath):
        print(f"Missing file: {filepath} — skipping {name}")
        return 0

    print(f"\n  Loading {name} from {filepath}...")
    start = time.time()

    with conn.cursor() as cur:
        with open(filepath, "r", encoding="utf-8") as f:
            # COPY receives only data rows; pandas wrote a header to each CSV.
            next(f)
            cur.copy_expert(
                sql.SQL("COPY {} ({}) FROM STDIN WITH (FORMAT CSV, NULL '')").format(
                    sql.Identifier(name.lower()),
                    sql.SQL(", ").join(sql.Identifier(c) for c in columns),
                ),
                f,
            )
    conn.commit()

    # Confirm what PostgreSQL actually received, not just what the CSV contained.
    with conn.cursor() as cur:
        cur.execute(sql.SQL("SELECT COUNT(*) FROM {}").format(sql.Identifier(name.lower())))
        count = cur.fetchone()[0]

    elapsed = time.time() - start
    print(f"  ✓ {name}: {count:,} rows loaded in {elapsed:.1f}s")
    return count


def validate(conn):
    """Check the relationships that matter most after a fresh load."""
    print("\n=== Validation ===")
    checks = [
        ("Orphan products (bad category_id)",
         """SELECT COUNT(*)
            FROM products p
            LEFT JOIN categories c ON p.category_id = c.category_id
            WHERE p.category_id IS NOT NULL
              AND c.category_id IS NULL"""),
        ("Orphan products (bad brand_id)",
         """SELECT COUNT(*)
            FROM products p
            LEFT JOIN brands b ON p.brand_id = b.brand_id
            WHERE p.brand_id IS NOT NULL
              AND b.brand_id IS NULL"""),
        ("Orphan reviews (bad asin)",
         """SELECT COUNT(*)
            FROM reviews r
            LEFT JOIN products p ON r.asin = p.asin
            WHERE p.asin IS NULL"""),
        ("Orphan reviews (bad user_id)",
         """SELECT COUNT(*)
            FROM reviews r
            LEFT JOIN users u ON r.user_id = u.user_id
            WHERE u.user_id IS NULL"""),
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


def validate_input_files():
    """Fail early if the cleaner has not produced the expected inputs."""
    missing = []

    if not os.path.exists(SCHEMA_FILE):
        missing.append(SCHEMA_FILE)

    for table in TABLES:
        path = os.path.join(CLEAN_DIR, table["file"])
        if not os.path.exists(path):
            missing.append(path)

    if missing:
        print("\nMissing required input files:")
        for path in missing:
            print(f"  - {path}")
        print(f"\nRun  python data_pipeline/clean_data.py  before ingesting.")
        sys.exit(1)

    print("\nInput files found:")
    print(f"  - {SCHEMA_FILE}")
    for table in TABLES:
        print(f"  - {os.path.join(CLEAN_DIR, table['file'])}")


def create_guest_user(conn):
    """Create or refresh the read-only login used for project review."""
    guest_user = os.getenv("GUEST_USER", "guest")
    guest_pass = os.getenv("GUEST_PASSWORD", "changeme")
    db_name = DB_CONFIG["dbname"]

    print(f"\n=== Creating guest user: {guest_user} ===")
    conn.commit()
    previous_autocommit = conn.autocommit
    conn.autocommit = True
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT 1 FROM pg_roles WHERE rolname = %s", [guest_user])
            role_exists = cur.fetchone() is not None

            if role_exists:
                cur.execute(
                    sql.SQL("ALTER ROLE {} WITH LOGIN PASSWORD %s").format(
                        sql.Identifier(guest_user)
                    ),
                    [guest_pass],
                )
            else:
                cur.execute(
                    sql.SQL("CREATE ROLE {} WITH LOGIN PASSWORD %s").format(
                        sql.Identifier(guest_user)
                    ),
                    [guest_pass],
                )

            cur.execute(
                sql.SQL("GRANT CONNECT ON DATABASE {} TO {}").format(
                    sql.Identifier(db_name), sql.Identifier(guest_user)
                )
            )
            cur.execute(
                sql.SQL("GRANT USAGE ON SCHEMA public TO {}").format(
                    sql.Identifier(guest_user)
                )
            )
            cur.execute(
                sql.SQL("GRANT SELECT ON ALL TABLES IN SCHEMA public TO {}").format(
                    sql.Identifier(guest_user)
                )
            )
            cur.execute(
                sql.SQL(
                    "ALTER DEFAULT PRIVILEGES IN SCHEMA public "
                    "GRANT SELECT ON TABLES TO {}"
                ).format(sql.Identifier(guest_user))
            )
    finally:
        conn.autocommit = previous_autocommit

    print(f"  Guest user '{guest_user}' created with read-only access.")
    print(f"  Include these credentials in your Milestone 3 submission.")


def main():
    print("=" * 60)
    print("  CIS 5500 — Database Ingestion Pipeline")
    print("=" * 60)

    dry_run = "--dry-run" in sys.argv
    validate_input_files()

    if dry_run:
        print("\nDry run complete. No database connection attempted.")
        return

    conn = get_connection()

    try:
        run_schema(conn)

        print("\n=== Loading Data ===")
        total_start = time.time()
        total_rows = 0
        for table in TABLES:
            total_rows += load_table(conn, table)

        total_elapsed = time.time() - total_start
        print(f"\n  Total: {total_rows:,} rows loaded in {total_elapsed:.1f}s")

        validate(conn)

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
