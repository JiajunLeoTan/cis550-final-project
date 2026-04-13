"""
CIS 5500 — Data-Driven Shopping Assistant
Data Cleaning Script

Usage:
    1. Place raw datasets in data/raw/:
         - amazon_products.csv   (Amazon Products Dataset 2023 from Kaggle)
         - amazon_reviews.csv    (Amazon Reviews 2023 from Kaggle)
         - amazon_categories.csv (Category lookup table)
    2. Run:  python scripts/clean_data.py
    3. Cleaned CSVs are written to data/cleaned/

Adjust INPUT_FILES column names below if your raw CSVs use different headers.
"""

import os
import re
import pandas as pd
import numpy as np
from tqdm import tqdm

# ---------------------------------------------------------------------------
# CONFIGURATION — adjust file paths and column names to match your raw data
# ---------------------------------------------------------------------------
RAW_DIR = os.path.join("data", "raw")
CLEAN_DIR = os.path.join("data", "cleaned")
os.makedirs(CLEAN_DIR, exist_ok=True)

def first_existing_path(*paths):
    """Return the first path that exists, or the first candidate if none do."""
    for path in paths:
        if os.path.exists(path):
            return path
    return paths[0]

RAW_PRODUCTS = os.path.join(RAW_DIR, "amazon_products.csv")
RAW_REVIEWS = first_existing_path(
    os.path.join(RAW_DIR, "amazon_reviews.csv"),
    os.path.join(RAW_DIR, "Amazon_reviews_2023.csv"),
)
RAW_CATEGORIES = os.path.join(RAW_DIR, "amazon_categories.csv")

# If your Kaggle CSV uses different column headers, remap them here.
# Keys = your raw column name, Values = our standardized name.
PRODUCT_COL_MAP = {
    "asin": "asin",
    "title": "title",
    "imgUrl": "img_url",
    "productURL": "product_url",
    "stars": "stars",
    "reviews": "review_count",
    "price": "price",
    "listPrice": "list_price",
    "isBestSeller": "is_best_seller",
    "boughtInLastMonth": "bought_in_last_month",
    "categoryName": "category_name",
}

REVIEW_COL_MAP = {
    "asin": "asin",
    "user_id": "user_id",
    "rating": "rating",
    "title": "review_title",
    "text": "review_text",
    "helpful_vote": "helpful_vote",
    "verified_purchase": "verified_purchase",
    "timestamp": "review_timestamp",
}

# ---------------------------------------------------------------------------
# HELPER FUNCTIONS
# ---------------------------------------------------------------------------

def parse_price(val):
    """Convert price strings like '$1,299.99' to float. Returns NaN on failure."""
    if pd.isna(val):
        return np.nan
    if isinstance(val, (int, float)):
        return float(val)
    val = str(val).replace("$", "").replace(",", "").strip()
    if val == "":
        return np.nan
    try:
        return float(val)
    except ValueError:
        return np.nan


def extract_brand(title):
    """
    Extract a brand name from an Amazon product title.

    Amazon titles typically follow: 'BrandName ProductDescription...'
    We grab everything before the first common delimiter.
    """
    if pd.isna(title) or title.strip() == "":
        return None

    # Common delimiters that separate brand from product description
    # Patterns: "Brand - Product", "Brand, Product", "Brand | Product"
    for sep in [" - ", " – ", " — ", " | ", ", "]:
        if sep in title:
            brand = title.split(sep)[0].strip()
            if 1 < len(brand) < 80:
                return brand
            break

    # Fallback: take first 1-3 words (many brands are 1-2 words)
    words = title.split()
    if len(words) >= 2:
        candidate = " ".join(words[:2])
        if len(candidate) < 80:
            return candidate

    return None


def normalize_brand(name):
    """Normalize brand names for deduplication."""
    if name is None or pd.isna(name):
        return None
    if not isinstance(name, str):
        name = str(name)
    # Lowercase, strip extra whitespace, remove trailing punctuation
    name = name.strip().title()
    name = re.sub(r"[®™©]+", "", name)
    name = name.strip(" .,;:-")
    return name if name else None


# ---------------------------------------------------------------------------
# STEP 1: CLEAN CATEGORIES
# ---------------------------------------------------------------------------
def clean_categories():
    print("\n=== Step 1: Cleaning Categories ===")
    df = pd.read_csv(RAW_CATEGORIES)
    df.columns = ["category_id", "category_name"]

    # Basic cleaning
    df["category_name"] = df["category_name"].str.strip()
    df = df.dropna(subset=["category_id", "category_name"])
    df = df.drop_duplicates(subset=["category_id"])
    df["category_id"] = df["category_id"].astype(int)

    out = os.path.join(CLEAN_DIR, "categories.csv")
    df.to_csv(out, index=False)
    print(f"  Wrote {len(df)} categories to {out}")
    return df


# ---------------------------------------------------------------------------
# STEP 2: CLEAN PRODUCTS
# ---------------------------------------------------------------------------
def clean_products(categories_df):
    print("\n=== Step 2: Cleaning Products ===")
    df = pd.read_csv(RAW_PRODUCTS, low_memory=False)

    # Rename columns to our standard names
    df = df.rename(columns=PRODUCT_COL_MAP)

    # --- Deduplication ---
    before = len(df)
    df = df.drop_duplicates(subset=["asin"], keep="first")
    print(f"  Dropped {before - len(df)} duplicate ASINs")

    # --- Drop rows missing essential fields ---
    df = df.dropna(subset=["asin", "title"])
    print(f"  Rows after dropping null asin/title: {len(df)}")

    # --- Parse prices ---
    df["price"] = df["price"].apply(parse_price)
    df["list_price"] = df["list_price"].apply(parse_price)

    # --- Type casting ---
    df["stars"] = pd.to_numeric(df["stars"], errors="coerce")
    df["review_count"] = pd.to_numeric(df["review_count"], errors="coerce").fillna(0).astype(int)
    df["bought_in_last_month"] = pd.to_numeric(df["bought_in_last_month"], errors="coerce").fillna(0).astype(int)

    # Handle isBestSeller — may be bool, string, or 0/1
    df["is_best_seller"] = df["is_best_seller"].map(
        {True: True, False: False, "True": True, "False": False,
         "true": True, "false": False, 1: True, 0: False}
    ).fillna(False)

    # --- Outlier flagging ---
    suspect_price = df["price"] > 10_000
    suspect_bought = df["bought_in_last_month"] > 50_000
    n_suspect = (suspect_price | suspect_bought).sum()
    if n_suspect > 0:
        print(f"  ⚠ {n_suspect} rows flagged as potential outliers (price>10k or bought>50k)")
        print(f"    Keeping them but you may want to inspect data/cleaned/outliers.csv")
        df[suspect_price | suspect_bought].to_csv(
            os.path.join(CLEAN_DIR, "outliers.csv"), index=False
        )

    # --- Normalize category linkage ---
    if "category_name" in df.columns:
        cat_lookup = dict(zip(categories_df["category_name"], categories_df["category_id"]))
        df["category_name"] = df["category_name"].astype("string").str.strip()
        df["category_id"] = df["category_name"].map(cat_lookup)

        unmatched = df["category_id"].isna().sum()
        if unmatched > 0:
            unmatched_names = df.loc[df["category_id"].isna(), "category_name"].dropna().unique()
            print(f"  ⚠ {unmatched} products have category names not in amazon_categories.csv")
            print(f"    Unmatched categories (first 10): {list(unmatched_names[:10])}")
    elif "category_id" in df.columns:
        df["category_id"] = pd.to_numeric(df["category_id"], errors="coerce").astype("Int64")
        valid_category_ids = set(categories_df["category_id"])
        invalid_categories = df["category_id"].notna() & ~df["category_id"].isin(valid_category_ids)
        unmatched = int(invalid_categories.sum())
        if unmatched > 0:
            unmatched_ids = df.loc[invalid_categories, "category_id"].dropna().unique()
            print(f"  ⚠ {unmatched} products have category IDs not in amazon_categories.csv")
            print(f"    Unmatched category IDs (first 10): {list(unmatched_ids[:10])}")
    else:
        raise KeyError("Expected 'category_name' or 'category_id' in products dataset")

    # --- Extract brands ---
    print("  Extracting brands from titles...")
    df["_raw_brand"] = df["title"].apply(extract_brand)
    df["_norm_brand"] = df["_raw_brand"].apply(normalize_brand)

    # Build brands table
    unique_brands = df["_norm_brand"].dropna().unique()
    brands_df = pd.DataFrame({
        "brand_id": range(1, len(unique_brands) + 1),
        "brand_name": unique_brands,
    })
    brand_lookup = dict(zip(brands_df["brand_name"], brands_df["brand_id"]))
    df["brand_id"] = df["_norm_brand"].map(brand_lookup).astype("Int64")

    print(f"  Extracted {len(brands_df)} unique brands")

    # --- Text cleaning ---
    df["title"] = df["title"].str.strip()

    # --- Select final columns ---
    products_out = df[[
        "asin", "title", "img_url", "product_url",
        "price", "list_price", "stars", "review_count",
        "is_best_seller", "bought_in_last_month",
        "category_id", "brand_id"
    ]]

    prod_path = os.path.join(CLEAN_DIR, "products.csv")
    products_out.to_csv(prod_path, index=False)
    print(f"  Wrote {len(products_out)} products to {prod_path}")

    brands_path = os.path.join(CLEAN_DIR, "brands.csv")
    brands_df.to_csv(brands_path, index=False)
    print(f"  Wrote {len(brands_df)} brands to {brands_path}")

    return products_out


# ---------------------------------------------------------------------------
# STEP 3: CLEAN REVIEWS
# ---------------------------------------------------------------------------
def clean_reviews(valid_asins: set):
    print("\n=== Step 3: Cleaning Reviews ===")
    # Read in chunks for large files
    chunks = pd.read_csv(RAW_REVIEWS, low_memory=False, chunksize=100_000)

    cleaned_chunks = []
    total_raw = 0
    total_orphans = 0
    total_dupes = 0

    for i, chunk in enumerate(tqdm(chunks, desc="  Processing review chunks")):
        chunk = chunk.rename(columns=REVIEW_COL_MAP)
        total_raw += len(chunk)

        # --- Drop rows missing essential fields ---
        chunk = chunk.dropna(subset=["asin", "user_id", "rating"])

        # --- Deduplication within chunk ---
        before = len(chunk)
        chunk = chunk.drop_duplicates(subset=["asin", "user_id", "review_timestamp"], keep="first")
        total_dupes += before - len(chunk)

        # --- Filter orphan reviews (asin not in cleaned products) ---
        before = len(chunk)
        chunk = chunk[chunk["asin"].isin(valid_asins)]
        total_orphans += before - len(chunk)

        # --- Type casting ---
        chunk["rating"] = pd.to_numeric(chunk["rating"], errors="coerce")
        chunk["helpful_vote"] = pd.to_numeric(chunk["helpful_vote"], errors="coerce").fillna(0).astype(int)

        # verified_purchase
        chunk["verified_purchase"] = chunk["verified_purchase"].map(
            {True: True, False: False, "True": True, "False": False,
             "true": True, "false": False, 1: True, 0: False}
        ).fillna(False)

        # Parse timestamp
        chunk["review_timestamp"] = pd.to_datetime(chunk["review_timestamp"], errors="coerce")

        # --- Fill missing text fields ---
        chunk["review_title"] = chunk["review_title"].fillna("")
        chunk["review_text"] = chunk["review_text"].fillna("")

        # --- Select columns ---
        chunk = chunk[[
            "asin", "user_id", "rating", "review_title", "review_text",
            "helpful_vote", "verified_purchase", "review_timestamp"
        ]]

        cleaned_chunks.append(chunk)

    reviews_df = pd.concat(cleaned_chunks, ignore_index=True)

    # Global deduplication (across chunks)
    before = len(reviews_df)
    reviews_df = reviews_df.drop_duplicates(subset=["asin", "user_id", "review_timestamp"], keep="first")
    total_dupes += before - len(reviews_df)

    # Add a sequential review_id
    reviews_df.insert(0, "review_id", range(1, len(reviews_df) + 1))

    print(f"  Total raw review rows: {total_raw}")
    print(f"  Duplicates removed:    {total_dupes}")
    print(f"  Orphan reviews removed:{total_orphans}")
    print(f"  Final review count:    {len(reviews_df)}")

    # --- Extract users ---
    users_df = pd.DataFrame({"user_id": reviews_df["user_id"].unique()})

    reviews_path = os.path.join(CLEAN_DIR, "reviews.csv")
    reviews_df.to_csv(reviews_path, index=False)
    print(f"  Wrote {len(reviews_df)} reviews to {reviews_path}")

    users_path = os.path.join(CLEAN_DIR, "users.csv")
    users_df.to_csv(users_path, index=False)
    print(f"  Wrote {len(users_df)} users to {users_path}")

    return reviews_df


# ---------------------------------------------------------------------------
# MAIN
# ---------------------------------------------------------------------------
def main():
    print("=" * 60)
    print("  CIS 5500 — Data Cleaning Pipeline")
    print("=" * 60)

    # Verify raw files exist
    for path, name in [
        (RAW_PRODUCTS, "Products"),
        (RAW_REVIEWS, "Reviews"),
        (RAW_CATEGORIES, "Categories"),
    ]:
        if not os.path.exists(path):
            print(f"\n Missing {name} dataset at: {path}")
            print(f"   Download it and place it there, then re-run.")
            return

    # Step 1
    categories_df = clean_categories()

    # Step 2
    products_df = clean_products(categories_df)
    valid_asins = set(products_df["asin"])

    # Step 3
    clean_reviews(valid_asins)

    # Summary
    print("\n" + "=" * 60)
    print("  Cleaning complete! Cleaned files in data/cleaned/:")
    for f in sorted(os.listdir(CLEAN_DIR)):
        size_mb = os.path.getsize(os.path.join(CLEAN_DIR, f)) / (1024 * 1024)
        print(f"    {f:30s} {size_mb:8.2f} MB")
    print("=" * 60)
    print("\nNext step: run  python scripts/ingest_data.py  to load into PostgreSQL.")


if __name__ == "__main__":
    main()
