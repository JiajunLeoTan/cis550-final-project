CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_products_title_trgm
    ON Products USING GIN (title gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_products_discount
    ON Products (
        ((1 - price / list_price)) DESC,
        review_count DESC,
        stars DESC NULLS LAST
    )
    WHERE list_price IS NOT NULL
      AND list_price > 0
      AND price IS NOT NULL
      AND price < list_price;

CREATE INDEX IF NOT EXISTS idx_products_category_stars_reviews
    ON Products(category_id, stars DESC NULLS LAST, review_count DESC);

DROP INDEX IF EXISTS idx_products_category_proven;
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

DROP INDEX IF EXISTS idx_products_brand_proven;
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

DROP MATERIALIZED VIEW IF EXISTS mv_value_score_components CASCADE;
CREATE MATERIALIZED VIEW mv_value_score_components AS
WITH category_price_bounds AS (
    SELECT
        category_id,
        MIN(price)::float AS min_price,
        MAX(price)::float AS max_price,
        AVG(price)::float AS avg_price,
        AVG(stars)::float AS avg_stars
    FROM Products
    WHERE price IS NOT NULL
      AND stars IS NOT NULL
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
        COALESCE(rr.recent_review_count, 0)::float AS recent_review_count
    FROM Products p
    JOIN category_price_bounds cpb ON cpb.category_id = p.category_id
    LEFT JOIN recent_reviews rr ON rr.asin = p.asin
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
    ON mv_value_score_components(stars DESC NULLS LAST, review_count DESC, price ASC NULLS LAST)
    WHERE recent_review_count > 0;
CREATE INDEX IF NOT EXISTS idx_mv_value_components_default_score
    ON mv_value_score_components(value_score_default DESC, stars DESC NULLS LAST, review_count DESC);
CREATE INDEX IF NOT EXISTS idx_mv_value_components_default_score_cover
    ON mv_value_score_components(value_score_default DESC NULLS LAST, stars DESC NULLS LAST, review_count DESC)
    INCLUDE (asin, category_id, brand_id, price, recent_review_count);
CREATE INDEX IF NOT EXISTS idx_mv_value_components_trending
    ON mv_value_score_components(category_id, recent_review_count DESC, stars DESC NULLS LAST, review_count DESC)
    INCLUDE (asin, brand_id, price);

DROP MATERIALIZED VIEW IF EXISTS mv_category_compare CASCADE;
CREATE MATERIALIZED VIEW mv_category_compare AS
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

DROP MATERIALIZED VIEW IF EXISTS mv_brand_performance CASCADE;
CREATE MATERIALIZED VIEW mv_brand_performance AS
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
        AVG(r.rating)::float AS avg_review_score,
        COALESCE(SUM(r.helpful_vote), 0)::int AS total_helpful_votes
    FROM Products p
    JOIN Reviews r ON r.asin = p.asin
    WHERE p.brand_id IS NOT NULL
      AND r.verified_purchase = TRUE
    GROUP BY p.brand_id
    HAVING COUNT(*) >= 10
)
SELECT
    bps.brand_id,
    bps.brand_name,
    bps.avg_product_rating,
    bps.total_products,
    brs.qualifying_review_count::int AS qualifying_review_count,
    brs.avg_review_score,
    brs.total_helpful_votes
FROM brand_product_stats bps
JOIN brand_review_stats brs ON bps.brand_id = brs.brand_id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_brand_performance_id
    ON mv_brand_performance(brand_id);
CREATE INDEX IF NOT EXISTS idx_mv_brand_performance_sort
    ON mv_brand_performance(avg_review_score DESC, total_helpful_votes DESC, brand_name ASC);

ANALYZE Products;
ANALYZE Reviews;
ANALYZE mv_value_score_components;
ANALYZE mv_category_compare;
ANALYZE mv_brand_performance;
