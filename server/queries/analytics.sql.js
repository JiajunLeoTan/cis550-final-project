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
    bps.total_products,
    brs.avg_review_score,
    brs.total_helpful_votes
  FROM brand_product_stats bps
  JOIN brand_review_stats brs ON bps.brand_id = brs.brand_id
  WHERE bps.avg_product_rating > 4.0
    AND brs.qualifying_review_count >= 10
  ORDER BY brs.avg_review_score DESC, brs.total_helpful_votes DESC, bps.brand_name ASC;
`;

const reviewsTrendQuery = `
  WITH reviewer_stats AS (
    SELECT
      user_id,
      COUNT(*) AS total_reviews
    FROM reviews
    GROUP BY user_id
  ),
  category_reviews AS (
    SELECT
      DATE_TRUNC('month', r.review_timestamp)::timestamp AS review_month,
      r.rating::float AS rating,
      r.verified_purchase,
      CASE
        WHEN rs.total_reviews >= 10 THEN 'high'
        ELSE 'low'
      END AS credibility_group
    FROM reviews r
    JOIN products p ON r.asin = p.asin
    JOIN categories c ON p.category_id = c.category_id
    JOIN reviewer_stats rs ON r.user_id = rs.user_id
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

module.exports = {
  categoriesCompareQuery,
  brandsPerformanceQuery,
  reviewsTrendQuery
};
