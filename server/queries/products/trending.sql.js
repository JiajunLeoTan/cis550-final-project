// Trending products within a category, ranked by recent review activity.

const trendingProductsQuery = `
  SELECT
    p.asin,
    p.title,
    p.img_url,
    p.price::float AS price,
    p.stars::float AS stars,
    p.review_count,
    COALESCE(r.recent_count, 0) AS recent_review_count,
    p.is_best_seller,
    b.brand_name
  FROM products p
  JOIN categories c ON p.category_id = c.category_id
  LEFT JOIN brands b ON p.brand_id = b.brand_id
  LEFT JOIN (
    SELECT
      asin,
      COUNT(*)::int AS recent_count
    FROM reviews
    WHERE review_timestamp >= NOW() - ($2::text || ' months')::interval
    GROUP BY asin
  ) r ON r.asin = p.asin
  WHERE c.category_name = $1
  ORDER BY recent_review_count DESC, p.stars DESC NULLS LAST, p.review_count DESC
  LIMIT 15;
`;

// Uses the value-components materialized view's data-relative recent-review
// count and idx_mv_value_components_trending for category top-N.
const trendingProductsQueryOptimized = `
  WITH top_products AS (
    SELECT
      m.asin,
      m.brand_id,
      m.price,
      m.stars,
      m.review_count,
      m.recent_review_count
    FROM categories c
    JOIN mv_value_score_components m ON m.category_id = c.category_id
    WHERE c.category_name = $1
      AND $2::int IS NOT NULL
    ORDER BY m.recent_review_count DESC, m.stars DESC NULLS LAST, m.review_count DESC
    LIMIT 15
  )
  SELECT
    tp.asin,
    p.title,
    p.img_url,
    tp.price::float AS price,
    tp.stars::float AS stars,
    tp.review_count::int AS review_count,
    tp.recent_review_count::int AS recent_review_count,
    p.is_best_seller,
    b.brand_name
  FROM top_products tp
  JOIN products p ON p.asin = tp.asin
  LEFT JOIN brands b ON tp.brand_id = b.brand_id
  ORDER BY tp.recent_review_count DESC, tp.stars DESC NULLS LAST, tp.review_count DESC
  LIMIT 15;
`;

module.exports = {
  trendingProductsQuery,
  trendingProductsQueryOptimized
};
