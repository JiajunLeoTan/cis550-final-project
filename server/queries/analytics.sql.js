const categoriesCompareQuery = `
  SELECT
    c.category_name,
    AVG(p.price)::float AS avg_price,
    AVG(p.stars)::float AS avg_rating,
    COUNT(p.asin)::int AS product_count
  FROM categories c
  LEFT JOIN products p ON p.category_id = c.category_id
  GROUP BY c.category_id, c.category_name
  ORDER BY c.category_name ASC;
`;

const brandsPerformanceQuery = `
  WITH brand_product_stats AS (
    SELECT
      b.brand_id,
      b.brand_name,
      AVG(p.stars)::float AS avg_product_rating,
      COUNT(DISTINCT CASE WHEN p.is_best_seller THEN p.asin END)::int AS total_products
    FROM brands b
    JOIN products p ON p.brand_id = b.brand_id
    GROUP BY b.brand_id, b.brand_name
  ),
  brand_review_stats AS (
    SELECT
      p.brand_id,
      COUNT(*) AS qualifying_review_count,
      AVG(r.rating)::float AS avg_review_score,
      COALESCE(SUM(r.helpful_vote), 0)::int AS total_helpful_votes
    FROM products p
    JOIN reviews r ON r.asin = p.asin
    WHERE p.brand_id IS NOT NULL
      AND r.verified_purchase = TRUE
    GROUP BY p.brand_id
  )
  SELECT
    bps.brand_name,
    bps.avg_product_rating,
    bps.avg_product_rating AS product_avg_rating,
    bps.total_products,
    brs.qualifying_review_count::int AS qualifying_review_count,
    brs.qualifying_review_count::int AS verified_review_count,
    brs.avg_review_score,
    brs.total_helpful_votes
  FROM brand_product_stats bps
  JOIN brand_review_stats brs ON bps.brand_id = brs.brand_id
  WHERE bps.avg_product_rating > 4.0
    AND brs.qualifying_review_count >= 10
  ORDER BY brs.avg_review_score DESC, brs.total_helpful_votes DESC, bps.brand_name ASC;
`;

const reviewsTrendQuery = `
  WITH category_reviews AS (
    SELECT
      DATE_TRUNC('month', r.review_timestamp)::timestamp AS review_month,
      r.rating::float AS rating,
      r.verified_purchase,
      CASE
        WHEN r.verified_purchase THEN 'high'
        ELSE 'low'
      END AS credibility_group
    FROM reviews r
    JOIN products p ON r.asin = p.asin
    JOIN categories c ON p.category_id = c.category_id
    WHERE c.category_name = $1
      AND r.review_timestamp IS NOT NULL
  )
  SELECT
    review_month,
    COUNT(*)::int AS total_reviews,
    AVG(rating)::float AS overall_avg_rating,
    AVG(CASE WHEN credibility_group = 'high' THEN rating END)::float AS high_cred_avg,
    AVG(CASE WHEN credibility_group = 'low' THEN rating END)::float AS low_cred_avg,
    (
      AVG(CASE WHEN credibility_group = 'high' THEN rating END)
      - AVG(CASE WHEN credibility_group = 'low' THEN rating END)
    )::float AS credibility_gap,
    (COUNT(*) FILTER (WHERE verified_purchase = TRUE))::int AS verified_count
  FROM category_reviews
  GROUP BY review_month
  ORDER BY review_month ASC;
`;

// --- Optimised variants ---
// Served from a materialized view populated by database/refresh_matviews.sql.
const categoriesCompareQueryOptimized = `
  SELECT
    category_name,
    avg_price,
    avg_rating,
    product_count
  FROM mv_category_compare
  ORDER BY category_name ASC;
`;

// Served from a materialized view populated by database/refresh_matviews.sql.
const brandsPerformanceQueryOptimized = `
  SELECT
    brand_name,
    avg_product_rating,
    avg_product_rating AS product_avg_rating,
    total_products,
    qualifying_review_count,
    qualifying_review_count AS verified_review_count,
    avg_review_score,
    total_helpful_votes
  FROM mv_brand_performance
  ORDER BY avg_review_score DESC, total_helpful_votes DESC, brand_name ASC;
`;

// Credibility = verified_purchase (a per-review flag), so there is no
// reviewer_stats CTE or self-join on reviews to optimize away. The plain
// query is already a single grouped scan; the route-level cache handles
// repeat hits.
const reviewsTrendQueryOptimized = reviewsTrendQuery;

module.exports = {
  categoriesCompareQuery,
  brandsPerformanceQuery,
  reviewsTrendQuery,
  categoriesCompareQueryOptimized,
  brandsPerformanceQueryOptimized,
  reviewsTrendQueryOptimized
};
