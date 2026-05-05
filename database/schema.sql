-- Database schema for the Axiom shopping assistant.
-- The ingestion script applies this before loading cleaned CSVs.

-- Drop children first so a reload starts from a clean set of tables.
DROP TABLE IF EXISTS Reviews CASCADE;
DROP TABLE IF EXISTS Users CASCADE;
DROP TABLE IF EXISTS Products CASCADE;
DROP TABLE IF EXISTS Brands CASCADE;
DROP TABLE IF EXISTS Categories CASCADE;

-- Category IDs come from amazon_categories.csv, so they are not generated here.
CREATE TABLE Categories (
    category_id INTEGER PRIMARY KEY,
    category_name VARCHAR(255) NOT NULL UNIQUE
);

-- Brands are extracted during cleaning because the product export has no brand table.
CREATE TABLE Brands (
    brand_id INTEGER PRIMARY KEY,
    brand_name VARCHAR(255) NOT NULL UNIQUE
);

-- Products
-- `bought_in_last_month` is not in the US asaniczka 1.4M export. Recent
-- popularity comes from Reviews.review_timestamp instead.
CREATE TABLE Products (
    asin VARCHAR(20) PRIMARY KEY,
    title VARCHAR(1024),
    img_url TEXT,
    product_url TEXT,
    price DECIMAL(10, 2),
    list_price DECIMAL(10, 2),
    stars DECIMAL(2, 1),
    review_count INTEGER DEFAULT 0,
    is_best_seller BOOLEAN DEFAULT FALSE,
    category_id INTEGER REFERENCES Categories(category_id),
    brand_id INTEGER REFERENCES Brands(brand_id)
);

-- Users
CREATE TABLE Users (
    user_id VARCHAR(128) PRIMARY KEY
);

-- Reviews
CREATE TABLE Reviews (
    review_id INTEGER PRIMARY KEY,
    asin VARCHAR(20) NOT NULL REFERENCES Products(asin),
    user_id VARCHAR(128) NOT NULL REFERENCES Users(user_id),
    rating DECIMAL(2, 1) NOT NULL,
    review_title VARCHAR(1024),
    review_text TEXT,
    helpful_vote INTEGER DEFAULT 0,
    verified_purchase BOOLEAN DEFAULT FALSE,
    review_timestamp TIMESTAMP
);

-- Basic indexes used by the original query paths and foreign-key lookups.
CREATE INDEX idx_products_category ON Products(category_id);
CREATE INDEX idx_products_brand ON Products(brand_id);
CREATE INDEX idx_products_stars ON Products(stars);
CREATE INDEX idx_products_price ON Products(price);
CREATE INDEX idx_reviews_asin ON Reviews(asin);
CREATE INDEX idx_reviews_user ON Reviews(user_id);
CREATE INDEX idx_reviews_rating ON Reviews(rating);
-- Extra indexes used by the optimized path and benchmark comparison.
CREATE INDEX idx_reviews_asin_timestamp ON Reviews(asin, review_timestamp);
CREATE INDEX idx_reviews_timestamp ON Reviews(review_timestamp);
CREATE INDEX idx_products_category_price ON Products(category_id, price);
CREATE INDEX idx_products_category_stars ON Products(category_id, stars);
CREATE INDEX IF NOT EXISTS idx_products_category_stars_reviews
    ON Products(category_id, stars DESC NULLS LAST, review_count DESC);
CREATE INDEX IF NOT EXISTS idx_products_category_proven
    ON Products(
        category_id,
        (CASE
            WHEN stars >= 4 AND COALESCE(review_count, 0) > 0 THEN 0
            WHEN COALESCE(review_count, 0) > 0 THEN 1
            WHEN stars >= 4 THEN 2
            ELSE 3
        END),
        (COALESCE(review_count, 0)) DESC,
        stars DESC NULLS LAST,
        is_best_seller DESC,
        asin ASC
    );
CREATE INDEX IF NOT EXISTS idx_products_brand_proven
    ON Products(
        brand_id,
        (CASE
            WHEN stars >= 4 AND COALESCE(review_count, 0) > 0 THEN 0
            WHEN COALESCE(review_count, 0) > 0 THEN 1
            WHEN stars >= 4 THEN 2
            ELSE 3
        END),
        (COALESCE(review_count, 0)) DESC,
        stars DESC NULLS LAST,
        is_best_seller DESC,
        asin ASC
    );
CREATE INDEX idx_reviews_verified ON Reviews(verified_purchase) WHERE verified_purchase = TRUE;

-- Precomputed structures for the optimized analytics and ranking routes.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_products_title_trgm
    ON Products USING GIN (title gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_products_discount
    ON Products (
        ((1 - price / list_price)) DESC,
        review_count DESC,
        stars DESC NULLS LAST,
        asin ASC
    )
    WHERE list_price IS NOT NULL
      AND list_price > 0
      AND price IS NOT NULL
      AND price < list_price;

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_value_score_components AS
WITH category_price_bounds AS (
    SELECT
        category_id,
        (MIN(price) FILTER (WHERE price IS NOT NULL AND stars IS NOT NULL))::float AS min_price,
        (MAX(price) FILTER (WHERE price IS NOT NULL AND stars IS NOT NULL))::float AS max_price,
        (AVG(price) FILTER (WHERE price IS NOT NULL))::float AS avg_price,
        (AVG(stars) FILTER (WHERE stars IS NOT NULL))::float AS avg_stars
    FROM Products
    GROUP BY category_id
),
review_horizon AS (
    SELECT COALESCE(MAX(review_timestamp), NOW()) - INTERVAL '12 months' AS start_at
    FROM Reviews
),
recent_reviews AS (
    SELECT
        r.asin,
        COUNT(*)::int AS recent_review_count
    FROM Reviews r
    CROSS JOIN review_horizon h
    WHERE r.review_timestamp >= h.start_at
    GROUP BY r.asin
),
latest_reviews AS (
    SELECT
        asin,
        MAX(review_timestamp) AS latest_review_timestamp
    FROM Reviews
    GROUP BY asin
),
base_components AS (
    SELECT
        p.asin,
        p.category_id,
        p.brand_id,
        p.stars::float AS stars,
        p.review_count::float AS review_count,
        p.price::float AS price,
        cpb.avg_price AS cat_avg_price,
        cpb.avg_stars AS cat_avg_stars,
        CASE
            WHEN cpb.max_price = cpb.min_price THEN 1.0
            ELSE 1.0 - (
                (p.price::float - cpb.min_price)
                / NULLIF(cpb.max_price - cpb.min_price, 0)
            )
        END AS price_efficiency,
        COALESCE(rr.recent_review_count, 0)::float AS recent_review_count,
        lr.latest_review_timestamp
    FROM Products p
    JOIN category_price_bounds cpb ON cpb.category_id = p.category_id
    LEFT JOIN recent_reviews rr ON rr.asin = p.asin
    LEFT JOIN latest_reviews lr ON lr.asin = p.asin
    WHERE p.price IS NOT NULL
      AND p.stars IS NOT NULL
),
bounds AS (
    SELECT
        MIN(stars) AS min_stars,
        MAX(stars) AS max_stars,
        MIN(review_count) AS min_review_count,
        MAX(review_count) AS max_review_count,
        MIN(price_efficiency) AS min_price_efficiency,
        MAX(price_efficiency) AS max_price_efficiency,
        MIN(recent_review_count) AS min_recent_review_count,
        MAX(recent_review_count) AS max_recent_review_count
    FROM base_components
),
normalized AS (
    SELECT
        bc.*,
        CASE
            WHEN b.max_stars = b.min_stars THEN 0
            ELSE (bc.stars - b.min_stars) / NULLIF(b.max_stars - b.min_stars, 0)
        END AS norm_stars,
        CASE
            WHEN b.max_review_count = b.min_review_count THEN 0
            ELSE (bc.review_count - b.min_review_count)
                / NULLIF(b.max_review_count - b.min_review_count, 0)
        END AS norm_review_count,
        CASE
            WHEN b.max_price_efficiency = b.min_price_efficiency THEN 0
            ELSE (bc.price_efficiency - b.min_price_efficiency)
                / NULLIF(b.max_price_efficiency - b.min_price_efficiency, 0)
        END AS norm_price_efficiency,
        CASE
            WHEN b.max_recent_review_count = b.min_recent_review_count THEN 0
            ELSE (bc.recent_review_count - b.min_recent_review_count)
                / NULLIF(b.max_recent_review_count - b.min_recent_review_count, 0)
        END AS norm_recent_review_count
    FROM base_components bc
    CROSS JOIN bounds b
)
SELECT
    asin,
    category_id,
    brand_id,
    stars,
    review_count,
    price,
    cat_avg_price,
    cat_avg_stars,
    price_efficiency,
    recent_review_count::int AS recent_review_count,
    latest_review_timestamp,
    norm_stars,
    norm_review_count,
    norm_price_efficiency,
    norm_recent_review_count,
    (
        0.4 * norm_stars
        + 0.2 * norm_review_count
        + 0.2 * norm_price_efficiency
        + 0.2 * norm_recent_review_count
    )::float AS value_score_default
FROM normalized;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_value_components_asin
    ON mv_value_score_components(asin);
CREATE INDEX IF NOT EXISTS idx_mv_value_components_category
    ON mv_value_score_components(category_id);
CREATE INDEX IF NOT EXISTS idx_mv_value_components_top_value
    ON mv_value_score_components(
        latest_review_timestamp DESC NULLS LAST,
        stars DESC NULLS LAST,
        review_count DESC,
        price ASC NULLS LAST,
        asin ASC
    )
    WHERE latest_review_timestamp IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_mv_value_components_default_score
    ON mv_value_score_components(value_score_default DESC, stars DESC NULLS LAST, review_count DESC, asin ASC);
CREATE INDEX IF NOT EXISTS idx_mv_value_components_default_score_cover
    ON mv_value_score_components(value_score_default DESC NULLS LAST, stars DESC NULLS LAST, review_count DESC, asin ASC)
    INCLUDE (category_id, brand_id, price, recent_review_count);
CREATE INDEX IF NOT EXISTS idx_mv_value_components_trending
    ON mv_value_score_components(category_id, recent_review_count DESC, stars DESC NULLS LAST, review_count DESC, asin ASC)
    INCLUDE (brand_id, price);

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_category_compare AS
SELECT
    c.category_id,
    c.category_name,
    AVG(p.price)::float AS avg_price,
    AVG(p.stars)::float AS avg_rating,
    COUNT(p.asin)::int AS product_count
FROM Categories c
LEFT JOIN Products p ON p.category_id = c.category_id
GROUP BY c.category_id, c.category_name;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_category_compare_id
    ON mv_category_compare(category_id);
CREATE INDEX IF NOT EXISTS idx_mv_category_compare_name
    ON mv_category_compare(category_name);

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_brand_performance AS
WITH brand_product_stats AS (
    SELECT
        b.brand_id,
        b.brand_name,
        AVG(p.stars)::float AS avg_product_rating,
        COUNT(DISTINCT CASE WHEN p.is_best_seller THEN p.asin END)::int AS total_products
    FROM Brands b
    JOIN Products p ON p.brand_id = b.brand_id
    GROUP BY b.brand_id, b.brand_name
    HAVING AVG(p.stars) > 4.0
),
brand_review_stats AS (
    SELECT
        p.brand_id,
        COUNT(*) AS qualifying_review_count,
        (COUNT(*) FILTER (WHERE r.verified_purchase = TRUE))::int AS verified_review_count,
        AVG(r.rating)::float AS avg_review_score,
        COALESCE(SUM(r.helpful_vote), 0)::int AS total_helpful_votes
    FROM Products p
    JOIN Reviews r ON r.asin = p.asin
    WHERE p.brand_id IS NOT NULL
    GROUP BY p.brand_id
    HAVING COUNT(*) >= 10
)
SELECT
    bps.brand_id,
    bps.brand_name,
    bps.avg_product_rating,
    bps.total_products,
    brs.qualifying_review_count::int AS qualifying_review_count,
    brs.verified_review_count,
    brs.avg_review_score,
    brs.total_helpful_votes
FROM brand_product_stats bps
JOIN brand_review_stats brs ON bps.brand_id = brs.brand_id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_brand_performance_id
    ON mv_brand_performance(brand_id);
CREATE INDEX IF NOT EXISTS idx_mv_brand_performance_sort
    ON mv_brand_performance(avg_review_score DESC, total_helpful_votes DESC, brand_name ASC);
