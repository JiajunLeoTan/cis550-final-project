"""
CIS 5500 — Data-Driven Shopping Assistant
Guest User Creation Script

Usage:
    1. Fill in .env with your database and guest credentials.
    2. Run from the project root:
         python scripts/create_guest_user.py

This script:
    - Connects to your PostgreSQL database
    - Creates or updates the guest login from .env
    - Grants the guest read-only access to all current tables
    - Grants default read-only access to future tables in schema public
"""

import os
import psycopg2
from psycopg2 import sql
from dotenv import load_dotenv

load_dotenv()

DB_CONFIG = {
    "host": os.getenv("DB_HOST", "localhost"),
    "port": os.getenv("DB_PORT", "5432"),
    "dbname": os.getenv("DB_NAME", "shopping_assistant"),
    "user": os.getenv("DB_USER", "postgres"),
    "password": os.getenv("DB_PASSWORD", ""),
}


def get_connection():
    """Create and return a database connection."""
    print(f"Connecting to {DB_CONFIG['host']}:{DB_CONFIG['port']}/{DB_CONFIG['dbname']}...")
    conn = psycopg2.connect(**DB_CONFIG)
    conn.autocommit = True
    return conn


def create_or_update_guest_user(conn):
    """Create or update a read-only guest account."""
    guest_user = os.getenv("GUEST_USER", "guest")
    guest_pass = os.getenv("GUEST_PASSWORD", "changeme")
    db_name = DB_CONFIG["dbname"]

    if guest_pass == "changeme":
        print("Warning: GUEST_PASSWORD is using the default placeholder value.")

    print(f"\n=== Creating or updating guest user: {guest_user} ===")
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
            print("  Updated existing role password and ensured LOGIN is enabled.")
        else:
            cur.execute(
                sql.SQL("CREATE ROLE {} WITH LOGIN PASSWORD %s").format(
                    sql.Identifier(guest_user)
                ),
                [guest_pass],
            )
            print("  Created new guest role.")

        cur.execute(
            sql.SQL("GRANT CONNECT ON DATABASE {} TO {}").format(
                sql.Identifier(db_name),
                sql.Identifier(guest_user),
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
                "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO {}"
            ).format(sql.Identifier(guest_user))
        )

    print(f"  Guest user '{guest_user}' has read-only access.")
    print("  Include these credentials in your Milestone 3 submission.")


def main():
    print("=" * 60)
    print("  CIS 5500 — Guest User Setup")
    print("=" * 60)

    conn = get_connection()
    try:
        create_or_update_guest_user(conn)
    finally:
        conn.close()
        print("\nConnection closed. Done!")


if __name__ == "__main__":
    main()
