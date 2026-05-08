"""
Clean the raw Amazon exports into the relational CSVs used by the app.

Run from the project root:
    python data_pipeline/clean_data.py
    python data_pipeline/clean_data.py --products-only

Expected inputs live in data/raw/. The script writes categories, brands,
products, users, and reviews to data/cleaned/ in the same shape that
database/schema.sql expects.

`bought_in_last_month` is not cleaned here because the US asaniczka 1.4M
dataset does not include it. The app computes recent popularity from
Reviews.review_timestamp instead.
"""

import argparse
import os
import re
import unicodedata
import pandas as pd
import numpy as np
from tqdm import tqdm

# File paths and raw-to-clean column naming.
RAW_DIR = os.path.join("data", "raw")
CLEAN_DIR = os.path.join("data", "cleaned")
os.makedirs(CLEAN_DIR, exist_ok=True)

def first_existing_path(*paths):
    """Pick the local dataset path that exists; keep the first name as fallback."""
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

MIN_CLEAN_PRODUCTS = 1_000_000
MIN_CLEAN_REVIEWS = 1_000_000
REVIEW_OUTPUT_COLUMNS = [
    "review_id",
    "asin",
    "user_id",
    "rating",
    "review_title",
    "review_text",
    "helpful_vote",
    "verified_purchase",
    "review_timestamp",
]

# The source files changed names and casing across exports, so we translate raw
# headers into the names used by our database tables.
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
    "categoryName": "category_name",
}

REVIEW_COL_MAP = {
    "asin": "asin",
    "parent_asin": "parent_asin",
    "user_id": "user_id",
    "rating": "rating",
    "title": "review_title",
    "text": "review_text",
    "helpful_vote": "helpful_vote",
    "verified_purchase": "verified_purchase",
    "timestamp": "review_timestamp",
}

# Small cleaning helpers shared by the product and review passes.
BRAND_SUFFIX_RE = re.compile(
    r"\b(?:incorporated|inc|company|co|llc|ltd|limited|corp|corporation)\.?$",
    re.IGNORECASE,
)


def parse_price(val):
    """Turn Amazon price text into a float; bad or blank values stay as NaN."""
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


def parse_review_timestamps(series):
    """Handle both readable timestamps and McAuley millisecond epoch values."""
    parsed = pd.Series(pd.NaT, index=series.index, dtype="datetime64[ns]")
    raw = series.astype("string")
    numeric = pd.to_numeric(raw, errors="coerce")
    numeric_mask = numeric.notna()
    text_mask = ~numeric_mask & raw.notna()

    if numeric_mask.any():
        parsed.loc[numeric_mask] = pd.to_datetime(
            numeric.loc[numeric_mask], unit="ms", errors="coerce"
        )
    if text_mask.any():
        parsed.loc[text_mask] = pd.to_datetime(raw.loc[text_mask], errors="coerce")

    return parsed


def extract_brand(title):
    """
    Guess a brand from the start of a product title.

    The product export does not include a brand column, so this is intentionally
    conservative: take the text before a familiar delimiter when possible, then
    fall back to the first couple of words.
    """
    if pd.isna(title) or title.strip() == "":
        return None

    # Titles often look like "Brand - Product" or "Brand, Product".
    for sep in [" - ", " – ", " — ", " | ", ", "]:
        if sep in title:
            brand = title.split(sep)[0].strip()
            if 1 < len(brand) < 80:
                return brand
            break

    # Most brand names in this data are short, so two words is a useful fallback.
    words = title.split()
    if len(words) >= 2:
        candidate = " ".join(words[:2])
        if len(candidate) < 80:
            return candidate

    return None


def normalize_brand(name):
    """Build the grouping key used to merge spelling and punctuation variants."""
    if name is None or pd.isna(name):
        return None
    if not isinstance(name, str):
        name = str(name)

    name = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode("ascii")
    name = re.sub(r"[®™©]+", "", name)
    name = re.sub(r"[^A-Za-z0-9&+\s.'-]+", " ", name)
    name = re.sub(r"\s+", " ", name).strip(" .,;:-_|/\\")

    while True:
        stripped = BRAND_SUFFIX_RE.sub("", name).strip(" .,;:-_|/\\")
        if stripped == name:
            break
        name = stripped

    key = re.sub(r"[^a-z0-9]+", "", name.lower())
    return key if key else None


def canonical_brand_name(name):
    """Return the display version of a brand after stripping legal suffix noise."""
    if name is None or pd.isna(name):
        return None
    if not isinstance(name, str):
        name = str(name)

    name = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode("ascii")
    name = re.sub(r"[®™©]+", "", name)
    name = re.sub(r"[^A-Za-z0-9&+\s.'-]+", " ", name)
    name = re.sub(r"\s+", " ", name).strip(" .,;:-_|/\\")

    while True:
        stripped = BRAND_SUFFIX_RE.sub("", name).strip(" .,;:-_|/\\")
        if stripped == name:
            break
        name = stripped

    name = re.sub(r"[^A-Za-z0-9&+\s'-]+", " ", name)
    name = re.sub(r"\s+", " ", name).strip()
    if not name:
        return None

    return " ".join(
        word.upper() if len(word) <= 3 and word.isupper() else word.capitalize()
        for word in name.split()
    )


def discover_review_files():
    """Use category review streams when present, otherwise use the legacy file."""
    review_files = [
        os.path.join(RAW_DIR, name)
        for name in sorted(os.listdir(RAW_DIR))
        if name.endswith(".csv") and not name.startswith("amazon_")
    ]
    if review_files:
        return review_files
    return [RAW_REVIEWS]


def validate_product_dimensions(categories_df, brands_df, products_df, valid_parent_asins):
    """Stop before writing a loadable-looking file that would violate the schema."""
    print("\n=== Product Dimension Validation ===")
    errors = []

    product_count = len(products_df)
    if product_count < MIN_CLEAN_PRODUCTS:
        errors.append(
            f"products.csv has {product_count:,} rows; expected at least {MIN_CLEAN_PRODUCTS:,}"
        )

    if products_df["asin"].isna().any():
        errors.append("products.csv contains null ASINs")
    if products_df["asin"].duplicated().any():
        errors.append("products.csv contains duplicate ASINs")

    if categories_df["category_id"].isna().any():
        errors.append("categories.csv contains null category_id values")
    if categories_df["category_id"].duplicated().any():
        errors.append("categories.csv contains duplicate category_id values")
    if categories_df["category_name"].duplicated().any():
        errors.append("categories.csv contains duplicate category_name values")

    if brands_df["brand_id"].isna().any():
        errors.append("brands.csv contains null brand_id values")
    if brands_df["brand_id"].duplicated().any():
        errors.append("brands.csv contains duplicate brand_id values")
    if brands_df["brand_name"].duplicated().any():
        errors.append("brands.csv contains duplicate brand_name values")

    valid_category_ids = set(categories_df["category_id"].dropna().astype(int))
    product_category_ids = set(products_df["category_id"].dropna().astype(int))
    missing_category_ids = product_category_ids - valid_category_ids
    if missing_category_ids:
        sample = sorted(missing_category_ids)[:10]
        errors.append(f"products.csv references missing category_id values: {sample}")

    valid_brand_ids = set(brands_df["brand_id"].dropna().astype(int))
    product_brand_ids = set(products_df["brand_id"].dropna().astype(int))
    missing_brand_ids = product_brand_ids - valid_brand_ids
    if missing_brand_ids:
        sample = sorted(missing_brand_ids)[:10]
        errors.append(f"products.csv references missing brand_id values: {sample}")

    if len(valid_parent_asins) != product_count:
        errors.append(
            "valid parent ASIN set size does not match cleaned product row count "
            f"({len(valid_parent_asins):,} vs {product_count:,})"
        )

    if errors:
        for error in errors:
            print(f"  ERROR: {error}")
        raise ValueError("Product dimension validation failed")

    print(f"  OK products: {product_count:,} rows")
    print(f"  OK categories: {len(categories_df):,} unique rows")
    print(f"  OK brands: {len(brands_df):,} unique rows")
    print(f"  OK valid parent ASINs: {len(valid_parent_asins):,}")


# Category dimension.
def clean_categories():
    print("\n=== Step 1: Cleaning Categories ===")
    df = pd.read_csv(RAW_CATEGORIES)
    df.columns = ["category_id", "category_name"]

    # Keep category IDs stable because products reference these IDs later.
    df["category_name"] = df["category_name"].str.strip()
    df = df.dropna(subset=["category_id", "category_name"])
    df = df.drop_duplicates(subset=["category_id"])
    df["category_id"] = df["category_id"].astype(int)

    out = os.path.join(CLEAN_DIR, "categories.csv")
    df.to_csv(out, index=False)
    print(f"  Wrote {len(df)} categories to {out}")
    return df


# Product and brand dimensions.
def clean_products(categories_df):
    print("\n=== Step 2: Cleaning Products ===")
    df = pd.read_csv(RAW_PRODUCTS, low_memory=False)

    # Work with the same names used in database/schema.sql from here on.
    df = df.rename(columns=PRODUCT_COL_MAP)

    # The product table uses ASIN as its primary key, so keep one row per ASIN.
    before = len(df)
    df = df.drop_duplicates(subset=["asin"], keep="first")
    print(f"  Dropped {before - len(df)} duplicate ASINs")

    # Without an ASIN or title, the row is not useful in the UI or schema.
    df = df.dropna(subset=["asin", "title"])
    print(f"  Rows after dropping null asin/title: {len(df)}")

    # Price fields arrive as strings with dollar signs and commas.
    df["price"] = df["price"].apply(parse_price)
    df["list_price"] = df["list_price"].apply(parse_price)
    non_positive_price = df["price"].notna() & (df["price"] <= 0)
    non_positive_list_price = df["list_price"].notna() & (df["list_price"] <= 0)
    if non_positive_price.any() or non_positive_list_price.any():
        print(
            "  Converted non-positive prices to NULL: "
            f"{int(non_positive_price.sum())} price, "
            f"{int(non_positive_list_price.sum())} list_price"
        )
        df.loc[non_positive_price, "price"] = np.nan
        df.loc[non_positive_list_price, "list_price"] = np.nan

    # Numeric columns are mixed strings/numbers in the raw export.
    df["stars"] = pd.to_numeric(df["stars"], errors="coerce")
    df["review_count"] = pd.to_numeric(df["review_count"], errors="coerce").fillna(0).astype(int)

    # Kaggle exports this flag as booleans, strings, or 0/1 depending on the file.
    df["is_best_seller"] = df["is_best_seller"].map(
        {True: True, False: False, "True": True, "False": False,
         "true": True, "false": False, 1: True, 0: False}
    ).fillna(False)

    # Keep suspicious prices in the product table, but leave a file for review.
    suspect_price = df["price"] > 10_000
    n_suspect = suspect_price.sum()
    if n_suspect > 0:
        print(f"  ⚠ {n_suspect} rows flagged as potential price outliers (price>10k)")
        print(f"    Keeping them but you may want to inspect data/cleaned/outliers.csv")
        df[suspect_price].to_csv(
            os.path.join(CLEAN_DIR, "outliers.csv"), index=False
        )

    # Products can identify categories by name or by ID depending on the export.
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

    # Brand is derived from titles because the product file has no brand column.
    print("  Extracting brands from titles...")
    df["_raw_brand"] = df["title"].apply(extract_brand)
    df["_brand_key"] = df["_raw_brand"].apply(normalize_brand)
    df["_brand_display"] = df["_raw_brand"].apply(canonical_brand_name)

    brand_counts = df["_brand_key"].dropna().value_counts()
    kept_brand_keys = set(brand_counts[brand_counts >= 5].index)
    dropped_brand_rows = int(df["_brand_key"].notna().sum() - df["_brand_key"].isin(kept_brand_keys).sum())

    brand_candidates = df[df["_brand_key"].isin(kept_brand_keys)][["_brand_key", "_brand_display"]].dropna()
    display_names = (
        brand_candidates
        .groupby("_brand_key")["_brand_display"]
        .agg(lambda values: values.value_counts().index[0])
    )

    brands_df = (
        pd.DataFrame({
            "_brand_key": list(kept_brand_keys),
            "brand_name": [display_names.get(key, key.title()) for key in kept_brand_keys],
            "product_count": [int(brand_counts[key]) for key in kept_brand_keys],
        })
        .sort_values(["brand_name", "_brand_key"])
        .reset_index(drop=True)
    )
    brands_df.insert(0, "brand_id", range(1, len(brands_df) + 1))
    if brands_df["brand_name"].duplicated().any():
        seen_names = {}
        unique_names = []
        for _, row in brands_df.iterrows():
            brand_name = row["brand_name"]
            if brand_name in seen_names:
                brand_name = f"{brand_name} {row['_brand_key'][:8].upper()}"
            seen_names[brand_name] = True
            unique_names.append(brand_name)
        brands_df["brand_name"] = unique_names

    brand_lookup = dict(zip(brands_df["_brand_key"], brands_df["brand_id"]))
    df["brand_id"] = df["_brand_key"].map(brand_lookup).astype("Int64")
    brands_df = brands_df[["brand_id", "brand_name"]]

    print(f"  Extracted {len(brands_df)} brands with >=5 products")
    print(f"  Set {dropped_brand_rows} products with singleton/rare brands to NULL brand_id")

    # Trim title whitespace after all title-based extraction is done.
    df["title"] = df["title"].str.strip()

    # Keep the full product catalog. Filtering to reviewed ASINs would drop the
    # product table far below the 1M-row rubric threshold.
    products_out = df[[
        "asin", "title", "img_url", "product_url",
        "price", "list_price", "stars", "review_count",
        "is_best_seller",
        "category_id", "brand_id"
    ]]
    valid_parent_asins = set(products_out["asin"].dropna().astype(str))

    validate_product_dimensions(
        categories_df,
        brands_df,
        products_out,
        valid_parent_asins,
    )

    prod_path = os.path.join(CLEAN_DIR, "products.csv")
    products_out.to_csv(prod_path, index=False)
    print(f"  Wrote {len(products_out)} products to {prod_path}")

    brands_path = os.path.join(CLEAN_DIR, "brands.csv")
    brands_df.to_csv(brands_path, index=False)
    print(f"  Wrote {len(brands_df)} brands to {brands_path}")
    print(f"  Kept {len(valid_parent_asins)} valid parent ASINs for review linking")

    return products_out, valid_parent_asins


# Review fact table and user dimension.
def clean_review_chunk(chunk, valid_parent_asins: set):
    """Clean one raw review chunk and return rows that link to known products."""
    stats = {
        "raw": len(chunk),
        "missing_required": 0,
        "orphans": 0,
        "dupes": 0,
        "parent_asin_fallbacks": 0,
    }

    chunk = chunk.rename(columns=REVIEW_COL_MAP)
    before = len(chunk)
    chunk = chunk.dropna(subset=["user_id", "rating"])
    stats["missing_required"] += before - len(chunk)

    if "parent_asin" not in chunk.columns:
        chunk["parent_asin"] = pd.NA
    if "asin" not in chunk.columns:
        chunk["asin"] = pd.NA
    for column, default in [
        ("review_title", ""),
        ("review_text", ""),
        ("helpful_vote", 0),
        ("verified_purchase", False),
        ("review_timestamp", pd.NaT),
    ]:
        if column not in chunk.columns:
            chunk[column] = default

    chunk["user_id"] = chunk["user_id"].astype("string").str.strip()
    chunk["asin"] = chunk["asin"].astype("string").str.strip()
    chunk["parent_asin"] = chunk["parent_asin"].astype("string").str.strip()
    chunk = chunk[
        chunk["user_id"].notna()
        & (chunk["user_id"] != "")
        & (
            (chunk["asin"].notna() & (chunk["asin"] != ""))
            | (chunk["parent_asin"].notna() & (chunk["parent_asin"] != ""))
        )
    ]

    direct_matches = chunk["asin"].isin(valid_parent_asins)
    parent_matches = chunk["parent_asin"].isin(valid_parent_asins)
    use_parent_asin = ~direct_matches & parent_matches
    stats["parent_asin_fallbacks"] += int(use_parent_asin.sum())
    chunk.loc[use_parent_asin, "asin"] = chunk.loc[use_parent_asin, "parent_asin"]

    chunk["rating"] = pd.to_numeric(chunk["rating"], errors="coerce")
    chunk = chunk.dropna(subset=["rating"])
    chunk = chunk[(chunk["rating"] >= 1) & (chunk["rating"] <= 5)]
    chunk["helpful_vote"] = pd.to_numeric(
        chunk["helpful_vote"], errors="coerce"
    ).fillna(0).clip(lower=0).astype(int)

    before = len(chunk)
    chunk = chunk[chunk["asin"].isin(valid_parent_asins)]
    stats["orphans"] += before - len(chunk)

    chunk["verified_purchase"] = chunk["verified_purchase"].map(
        {True: True, False: False, "True": True, "False": False,
         "true": True, "false": False, 1: True, 0: False}
    ).fillna(False)
    chunk["review_timestamp"] = parse_review_timestamps(chunk["review_timestamp"])
    chunk["review_title"] = chunk["review_title"].fillna("")
    chunk["review_text"] = chunk["review_text"].fillna("")

    before = len(chunk)
    chunk = chunk.drop_duplicates(subset=["asin", "user_id", "review_timestamp"], keep="first")
    stats["dupes"] += before - len(chunk)

    chunk = chunk[[
        "asin", "user_id", "rating", "review_title", "review_text",
        "helpful_vote", "verified_purchase", "review_timestamp"
    ]]

    return chunk, stats


def dedupe_against_seen(chunk, seen_review_keys: set):
    """Remove review duplicates that appear across chunk or file boundaries."""
    if chunk.empty:
        return chunk, 0

    timestamp_keys = chunk["review_timestamp"].astype("int64")
    keep_mask = []
    duplicate_count = 0
    for key in zip(chunk["asin"], chunk["user_id"], timestamp_keys):
        if key in seen_review_keys:
            keep_mask.append(False)
            duplicate_count += 1
        else:
            seen_review_keys.add(key)
            keep_mask.append(True)

    return chunk.loc[keep_mask], duplicate_count


def clean_reviews(valid_parent_asins: set, review_files):
    """Stream review CSVs into reviews.csv and users.csv without loading all rows."""
    print("\n=== Step 3: Cleaning Reviews ===")
    print("  Review sources:")
    for path in review_files:
        print(f"    - {path}")

    reviews_path = os.path.join(CLEAN_DIR, "reviews.csv")
    users_path = os.path.join(CLEAN_DIR, "users.csv")

    total_raw = 0
    total_missing_required = 0
    total_orphans = 0
    total_dupes = 0
    total_parent_asin_fallbacks = 0
    total_written = 0
    users = set()
    seen_review_keys = set()
    wrote_header = False

    for path in review_files:
        chunks = pd.read_csv(path, low_memory=False, chunksize=100_000)
        for chunk in tqdm(chunks, desc=f"  Processing {os.path.basename(path)}"):
            cleaned_chunk, stats = clean_review_chunk(chunk, valid_parent_asins)
            total_raw += stats["raw"]
            total_missing_required += stats["missing_required"]
            total_orphans += stats["orphans"]
            total_dupes += stats["dupes"]
            total_parent_asin_fallbacks += stats["parent_asin_fallbacks"]

            cleaned_chunk, global_dupes = dedupe_against_seen(cleaned_chunk, seen_review_keys)
            total_dupes += global_dupes
            if cleaned_chunk.empty:
                continue

            users.update(cleaned_chunk["user_id"].dropna().astype(str).unique())
            next_review_id = total_written + 1
            cleaned_chunk.insert(
                0,
                "review_id",
                range(next_review_id, next_review_id + len(cleaned_chunk)),
            )
            cleaned_chunk.to_csv(
                reviews_path,
                mode="w" if not wrote_header else "a",
                index=False,
                header=not wrote_header,
                columns=REVIEW_OUTPUT_COLUMNS,
            )
            wrote_header = True
            total_written += len(cleaned_chunk)

    if not wrote_header:
        pd.DataFrame(columns=REVIEW_OUTPUT_COLUMNS).to_csv(reviews_path, index=False)

    print(f"  Total raw review rows: {total_raw}")
    print(f"  Missing required rows: {total_missing_required}")
    print(f"  parent_asin fallbacks: {total_parent_asin_fallbacks}")
    print(f"  Duplicates removed:    {total_dupes}")
    print(f"  Orphan reviews removed:{total_orphans}")
    print(f"  Final review count:    {total_written}")

    # Users are the distinct reviewer IDs that survived review filtering.
    users_df = pd.DataFrame({"user_id": sorted(users)})
    users_df.to_csv(users_path, index=False)
    print(f"  Wrote {total_written} reviews to {reviews_path}")
    print(f"  Wrote {len(users_df)} users to {users_path}")

    if total_written < MIN_CLEAN_REVIEWS:
        raise ValueError(
            f"reviews.csv has {total_written:,} rows; expected at least {MIN_CLEAN_REVIEWS:,}"
        )

    return total_written


def parse_args():
    parser = argparse.ArgumentParser(description="Clean raw Amazon data into relational CSVs.")
    parser.add_argument(
        "--products-only",
        action="store_true",
        help="regenerate only categories.csv, products.csv, and brands.csv",
    )
    return parser.parse_args()


def main():
    args = parse_args()

    print("=" * 60)
    print("  CIS 5500 — Data Cleaning Pipeline")
    print("=" * 60)

    # Check paths before spending time on a partial cleaning run.
    required_inputs = [
        (RAW_PRODUCTS, "Products"),
        (RAW_CATEGORIES, "Categories"),
    ]
    review_files = []
    if not args.products_only:
        review_files = discover_review_files()
        required_inputs.extend(
            (path, f"Reviews ({os.path.basename(path)})")
            for path in review_files
        )

    for path, name in required_inputs:
        if not os.path.exists(path):
            print(f"\n Missing {name} dataset at: {path}")
            print(f"   Download it and place it there, then re-run.")
            return

    categories_df = clean_categories()

    _products_df, valid_parent_asins = clean_products(categories_df)

    if args.products_only:
        print("\n=== Step 3: Review Cleaning Skipped ===")
        print("  Product dimensions are ready for parent_asin-based review linking.")
    else:
        clean_reviews(valid_parent_asins, review_files)

    print("\n" + "=" * 60)
    print("  Cleaning complete! Cleaned files in data/cleaned/:")
    for f in sorted(os.listdir(CLEAN_DIR)):
        size_mb = os.path.getsize(os.path.join(CLEAN_DIR, f)) / (1024 * 1024)
        print(f"    {f:30s} {size_mb:8.2f} MB")
    print("=" * 60)
    print("\nNext step: run  python data_pipeline/ingest_data.py  to load into PostgreSQL.")


if __name__ == "__main__":
    main()
