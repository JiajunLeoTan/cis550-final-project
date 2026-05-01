const productExistsQuery = `
  SELECT 1
  FROM products
  WHERE asin = $1;
`;

const searchProductsQuery = `
  SELECT
    asin,
    title,
    price::float AS price,
    stars::float AS stars,
    is_best_seller
  FROM products
  WHERE title ILIKE '%' || $1 || '%'
    AND COALESCE(stars, 0) >= $2
  ORDER BY stars DESC NULLS LAST, review_count DESC, title ASC;
`;

const dealsQuery = `
  SELECT
    p.asin,
    p.title,
    p.price::float AS price,
    p.list_price::float AS list_price,
    ROUND(((1 - (p.price / NULLIF(p.list_price, 0))) * 100)::numeric, 1)::float AS discount_pct,
    p.stars::float AS stars,
    p.review_count,
    c.category_name
  FROM products p
  JOIN categories c ON p.category_id = c.category_id
  WHERE p.price IS NOT NULL
    AND p.list_price IS NOT NULL
    AND p.list_price > 0
    AND p.price < p.list_price
    AND p.price <= $1
  ORDER BY discount_pct DESC NULLS LAST, p.review_count DESC, p.stars DESC NULLS LAST;
`;

const ratingDistributionQuery = `
  SELECT
    levels.rating::float AS rating,
    COUNT(r.review_id)::int AS review_count,
    COALESCE(AVG(CASE WHEN r.verified_purchase THEN 1.0 ELSE 0.0 END), 0)::float AS verified_ratio
  FROM generate_series(1, 5) AS levels(rating)
  LEFT JOIN reviews r
    ON r.asin = $1
   AND r.rating = levels.rating
  GROUP BY levels.rating
  ORDER BY levels.rating ASC;
`;

const helpfulReviewsQuery = `
  WITH reviewer_stats AS (
    SELECT
      user_id,
      COUNT(*)::int AS total_reviews,
      AVG(rating)::float AS avg_rating
    FROM reviews
    GROUP BY user_id
  )
  SELECT
    r.review_id,
    r.rating::float AS rating,
    r.review_title,
    r.review_text,
    r.helpful_vote,
    r.verified_purchase,
    r.review_timestamp,
    rs.total_reviews AS reviewer_total_reviews,
    rs.avg_rating::float AS reviewer_avg_rating
  FROM reviews r
  JOIN reviewer_stats rs ON r.user_id = rs.user_id
  WHERE r.asin = $1
  ORDER BY r.helpful_vote DESC, r.review_timestamp DESC NULLS LAST, r.review_id ASC
  LIMIT 10;
`;

const alternativesQuery = `
  WITH target AS (
    SELECT
      asin,
      category_id,
      stars,
      price
    FROM products
    WHERE asin = $1
  )
  SELECT
    p.asin,
    p.title,
    p.price::float AS price,
    p.stars::float AS stars,
    c.category_name
  FROM target t
  JOIN products p ON p.category_id = t.category_id
  JOIN categories c ON p.category_id = c.category_id
  WHERE p.asin <> $1
    AND t.price IS NOT NULL
    AND t.stars IS NOT NULL
    AND p.price IS NOT NULL
    AND p.stars IS NOT NULL
    AND p.price < t.price
    AND p.stars > t.stars
  ORDER BY p.stars DESC NULLS LAST, p.price ASC NULLS LAST, p.review_count DESC
  LIMIT 5;
`;

const trendingProductsQuery = `
  SELECT
    p.asin,
    p.title,
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

const topValueProductsQuery = `
  -- Intentionally left as correlated subqueries so Milestone 5 can optimize it later.
  SELECT
    p.asin,
    p.title,
    p.price::float AS price,
    p.stars::float AS stars,
    c.category_name
  FROM products p
  JOIN categories c ON p.category_id = c.category_id
  WHERE p.price IS NOT NULL
    AND p.stars IS NOT NULL
    AND p.price < (
      SELECT AVG(p2.price)
      FROM products p2
      WHERE p2.category_id = p.category_id
        AND p2.price IS NOT NULL
    )
    AND p.stars > (
      SELECT AVG(p3.stars)
      FROM products p3
      WHERE p3.category_id = p.category_id
        AND p3.stars IS NOT NULL
    )
    AND EXISTS (
      SELECT 1
      FROM reviews r
      WHERE r.asin = p.asin
        AND r.review_timestamp >= $1::timestamp
    )
  ORDER BY p.stars DESC NULLS LAST, p.review_count DESC, p.price ASC NULLS LAST
  LIMIT 100;
`;

const valueRankingsQuery = `
  -- Intentionally duplicates expensive scans so the optimization pass has a meaningful baseline.
  WITH recent_reviews AS (
    SELECT
      r.asin,
      COUNT(*)::int AS recent_review_count
    FROM reviews r
    WHERE r.review_timestamp >= NOW() - INTERVAL '3 months'
    GROUP BY r.asin
  ),
  dimension_bounds AS (
    SELECT
      MIN(p.stars::float) AS min_stars,
      MAX(p.stars::float) AS max_stars,
      MIN(p.review_count::float) AS min_review_count,
      MAX(p.review_count::float) AS max_review_count,
      MIN(
        CASE
          WHEN category_price_bounds.max_price = category_price_bounds.min_price THEN 1.0
          ELSE 1.0 - (
            (p.price::float - category_price_bounds.min_price)
            / NULLIF(category_price_bounds.max_price - category_price_bounds.min_price, 0)
          )
        END
      ) AS min_price_efficiency,
      MAX(
        CASE
          WHEN category_price_bounds.max_price = category_price_bounds.min_price THEN 1.0
          ELSE 1.0 - (
            (p.price::float - category_price_bounds.min_price)
            / NULLIF(category_price_bounds.max_price - category_price_bounds.min_price, 0)
          )
        END
      ) AS max_price_efficiency,
      MIN(COALESCE(rr.recent_review_count, 0)::float) AS min_recent_review_count,
      MAX(COALESCE(rr.recent_review_count, 0)::float) AS max_recent_review_count
    FROM products p
    LEFT JOIN recent_reviews rr ON rr.asin = p.asin
    JOIN (
      SELECT
        category_id,
        MIN(price::float) AS min_price,
        MAX(price::float) AS max_price
      FROM products
      WHERE price IS NOT NULL
      GROUP BY category_id
    ) category_price_bounds ON category_price_bounds.category_id = p.category_id
    WHERE p.price IS NOT NULL
      AND p.stars IS NOT NULL
  )
  SELECT
    p.asin,
    p.title,
    p.price::float AS price,
    p.stars::float AS stars,
    p.review_count,
    COALESCE(rr.recent_review_count, 0)::int AS recent_review_count,
    p.img_url,
    c.category_name,
    b.brand_name,
    COALESCE((
      (
        $1 * CASE
          WHEN db.max_stars = db.min_stars THEN 0
          ELSE (p.stars::float - db.min_stars) / NULLIF(db.max_stars - db.min_stars, 0)
        END
      ) +
      (
        $2 * CASE
          WHEN db.max_review_count = db.min_review_count THEN 0
          ELSE (p.review_count::float - db.min_review_count)
            / NULLIF(db.max_review_count - db.min_review_count, 0)
        END
      ) +
      (
        $3 * CASE
          WHEN db.max_price_efficiency = db.min_price_efficiency THEN 0
          ELSE (
            (
              CASE
                WHEN category_price_bounds.max_price = category_price_bounds.min_price THEN 1.0
                ELSE 1.0 - (
                  (p.price::float - category_price_bounds.min_price)
                  / NULLIF(category_price_bounds.max_price - category_price_bounds.min_price, 0)
                )
              END
            ) - db.min_price_efficiency
          ) / NULLIF(db.max_price_efficiency - db.min_price_efficiency, 0)
        END
      ) +
      (
        $4 * CASE
          WHEN db.max_recent_review_count = db.min_recent_review_count THEN 0
          ELSE (COALESCE(rr.recent_review_count, 0)::float - db.min_recent_review_count)
            / NULLIF(db.max_recent_review_count - db.min_recent_review_count, 0)
        END
      )
    ) / NULLIF($1 + $2 + $3 + $4, 0), 0)::float AS value_score
  FROM products p
  JOIN categories c ON p.category_id = c.category_id
  LEFT JOIN brands b ON p.brand_id = b.brand_id
  LEFT JOIN recent_reviews rr ON rr.asin = p.asin
  JOIN (
    SELECT
      category_id,
      MIN(price::float) AS min_price,
      MAX(price::float) AS max_price
    FROM products
    WHERE price IS NOT NULL
    GROUP BY category_id
  ) category_price_bounds ON category_price_bounds.category_id = p.category_id
  CROSS JOIN dimension_bounds db
  WHERE p.price IS NOT NULL
    AND p.stars IS NOT NULL
  ORDER BY value_score DESC NULLS LAST, p.stars DESC NULLS LAST, p.review_count DESC
  LIMIT 100;
`;

// --- Optimised variants ---

// LIMIT 1 lets the planner stop on the first PK match.
const productExistsQueryOptimized = `
  SELECT 1
  FROM products
  WHERE asin = $1
  LIMIT 1;
`;

// Add a LIMIT so we don't sort the entire match set when the UI only shows
// the top results.
const searchProductsQueryOptimized = `
  SELECT
    asin,
    title,
    price::float AS price,
    stars::float AS stars,
    is_best_seller
  FROM products
  WHERE title ILIKE '%' || $1 || '%'
    AND COALESCE(stars, 0) >= $2
  ORDER BY stars DESC NULLS LAST, review_count DESC, title ASC
  LIMIT 100;
`;

// Add LIMIT and drop the dead NULLIF (list_price > 0 is already enforced).
const dealsQueryOptimized = `
  SELECT
    p.asin,
    p.title,
    p.price::float AS price,
    p.list_price::float AS list_price,
    ROUND(((1 - (p.price / p.list_price)) * 100)::numeric, 1)::float AS discount_pct,
    p.stars::float AS stars,
    p.review_count,
    c.category_name
  FROM products p
  JOIN categories c ON p.category_id = c.category_id
  WHERE p.price IS NOT NULL
    AND p.list_price IS NOT NULL
    AND p.list_price > 0
    AND p.price < p.list_price
    AND p.price <= $1
  ORDER BY discount_pct DESC NULLS LAST, p.review_count DESC, p.stars DESC NULLS LAST
  LIMIT 100;
`;

// Aggregate first (≤5 groups), then LEFT JOIN generate_series to pad
// missing ratings. Avoids row-by-row joining of a series with reviews
// before grouping.
const ratingDistributionQueryOptimized = `
  WITH counts AS (
    SELECT
      rating,
      COUNT(*)::int AS review_count,
      AVG(CASE WHEN verified_purchase THEN 1.0 ELSE 0.0 END)::float AS verified_ratio
    FROM reviews
    WHERE asin = $1
    GROUP BY rating
  )
  SELECT
    levels.rating::float AS rating,
    COALESCE(counts.review_count, 0)::int AS review_count,
    COALESCE(counts.verified_ratio, 0)::float AS verified_ratio
  FROM generate_series(1, 5) AS levels(rating)
  LEFT JOIN counts ON counts.rating = levels.rating
  ORDER BY levels.rating ASC;
`;

// Take the top 10 reviews first, then look up reviewer stats only for those
// 10 users via LATERAL. The original aggregates over every user in the
// reviews table even though only 10 are kept.
const helpfulReviewsQueryOptimized = `
  WITH top_reviews AS (
    SELECT *
    FROM reviews
    WHERE asin = $1
    ORDER BY helpful_vote DESC, review_timestamp DESC NULLS LAST, review_id ASC
    LIMIT 10
  )
  SELECT
    tr.review_id,
    tr.rating::float AS rating,
    tr.review_title,
    tr.review_text,
    tr.helpful_vote,
    tr.verified_purchase,
    tr.review_timestamp,
    rs.total_reviews AS reviewer_total_reviews,
    rs.avg_rating AS reviewer_avg_rating
  FROM top_reviews tr
  LEFT JOIN LATERAL (
    SELECT
      COUNT(*)::int AS total_reviews,
      AVG(rating)::float AS avg_rating
    FROM reviews r2
    WHERE r2.user_id = tr.user_id
  ) rs ON TRUE
  ORDER BY tr.helpful_vote DESC, tr.review_timestamp DESC NULLS LAST, tr.review_id ASC;
`;

// Replace the JOIN target CTE with scalar subqueries on the PK lookup.
// Eliminates the cross-join with target and turns price/stars comparisons
// into clean predicates against a constant.
const alternativesQueryOptimized = `
  SELECT
    p.asin,
    p.title,
    p.price::float AS price,
    p.stars::float AS stars,
    c.category_name
  FROM products p
  JOIN categories c ON p.category_id = c.category_id
  WHERE p.category_id = (SELECT category_id FROM products WHERE asin = $1)
    AND p.asin <> $1
    AND p.price IS NOT NULL
    AND p.stars IS NOT NULL
    AND p.price < (SELECT price FROM products WHERE asin = $1)
    AND p.stars > (SELECT stars FROM products WHERE asin = $1)
  ORDER BY p.stars DESC NULLS LAST, p.price ASC NULLS LAST, p.review_count DESC
  LIMIT 5;
`;

// Push the category filter inside the recent_count subquery so we only
// aggregate reviews for products in this category, not the entire reviews
// table for the time window.
const trendingProductsQueryOptimized = `
  SELECT
    p.asin,
    p.title,
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
      rev.asin,
      COUNT(*)::int AS recent_count
    FROM reviews rev
    JOIN products pp ON pp.asin = rev.asin
    JOIN categories cc ON pp.category_id = cc.category_id
    WHERE rev.review_timestamp >= NOW() - ($2::text || ' months')::interval
      AND cc.category_name = $1
    GROUP BY rev.asin
  ) r ON r.asin = p.asin
  WHERE c.category_name = $1
  ORDER BY recent_review_count DESC, p.stars DESC NULLS LAST, p.review_count DESC
  LIMIT 15;
`;

// Replace the per-row correlated AVG subqueries with a single CTE that
// computes per-category averages once. Goes from O(N x categories) scans
// to one pass.
const topValueProductsQueryOptimized = `
  WITH cat_avgs AS (
    SELECT
      category_id,
      AVG(price) AS avg_price,
      AVG(stars) AS avg_stars
    FROM products
    GROUP BY category_id
  ),
  recent_asins AS (
    SELECT DISTINCT asin
    FROM reviews
    WHERE review_timestamp >= $1::timestamp
  )
  SELECT
    p.asin,
    p.title,
    p.price::float AS price,
    p.stars::float AS stars,
    c.category_name
  FROM products p
  JOIN categories c ON p.category_id = c.category_id
  JOIN cat_avgs ca ON ca.category_id = p.category_id
  JOIN recent_asins ra ON ra.asin = p.asin
  WHERE p.price IS NOT NULL
    AND p.stars IS NOT NULL
    AND p.price < ca.avg_price
    AND p.stars > ca.avg_stars
  ORDER BY p.stars DESC NULLS LAST, p.review_count DESC, p.price ASC NULLS LAST
  LIMIT 100;
`;

// Hoist category_price_bounds and the per-product price_efficiency
// expression into shared CTEs so they are computed once instead of being
// recomputed inline both inside dimension_bounds and in the main SELECT.
const valueRankingsQueryOptimized = `
  WITH recent_reviews AS (
    SELECT
      r.asin,
      COUNT(*)::int AS recent_review_count
    FROM reviews r
    WHERE r.review_timestamp >= NOW() - INTERVAL '3 months'
    GROUP BY r.asin
  ),
  category_price_bounds AS (
    SELECT
      category_id,
      MIN(price::float) AS min_price,
      MAX(price::float) AS max_price
    FROM products
    WHERE price IS NOT NULL
    GROUP BY category_id
  ),
  product_price_eff AS (
    SELECT
      p.asin,
      CASE
        WHEN cpb.max_price = cpb.min_price THEN 1.0
        ELSE 1.0 - (
          (p.price::float - cpb.min_price)
          / NULLIF(cpb.max_price - cpb.min_price, 0)
        )
      END AS price_efficiency
    FROM products p
    JOIN category_price_bounds cpb ON cpb.category_id = p.category_id
    WHERE p.price IS NOT NULL
  ),
  dimension_bounds AS (
    SELECT
      MIN(p.stars::float) AS min_stars,
      MAX(p.stars::float) AS max_stars,
      MIN(p.review_count::float) AS min_review_count,
      MAX(p.review_count::float) AS max_review_count,
      MIN(ppe.price_efficiency) AS min_price_efficiency,
      MAX(ppe.price_efficiency) AS max_price_efficiency,
      MIN(COALESCE(rr.recent_review_count, 0)::float) AS min_recent_review_count,
      MAX(COALESCE(rr.recent_review_count, 0)::float) AS max_recent_review_count
    FROM products p
    JOIN product_price_eff ppe ON ppe.asin = p.asin
    LEFT JOIN recent_reviews rr ON rr.asin = p.asin
    WHERE p.price IS NOT NULL
      AND p.stars IS NOT NULL
  )
  SELECT
    p.asin,
    p.title,
    p.price::float AS price,
    p.stars::float AS stars,
    p.review_count,
    COALESCE(rr.recent_review_count, 0)::int AS recent_review_count,
    p.img_url,
    c.category_name,
    b.brand_name,
    COALESCE((
      (
        $1 * CASE
          WHEN db.max_stars = db.min_stars THEN 0
          ELSE (p.stars::float - db.min_stars) / NULLIF(db.max_stars - db.min_stars, 0)
        END
      ) +
      (
        $2 * CASE
          WHEN db.max_review_count = db.min_review_count THEN 0
          ELSE (p.review_count::float - db.min_review_count)
            / NULLIF(db.max_review_count - db.min_review_count, 0)
        END
      ) +
      (
        $3 * CASE
          WHEN db.max_price_efficiency = db.min_price_efficiency THEN 0
          ELSE (ppe.price_efficiency - db.min_price_efficiency)
            / NULLIF(db.max_price_efficiency - db.min_price_efficiency, 0)
        END
      ) +
      (
        $4 * CASE
          WHEN db.max_recent_review_count = db.min_recent_review_count THEN 0
          ELSE (COALESCE(rr.recent_review_count, 0)::float - db.min_recent_review_count)
            / NULLIF(db.max_recent_review_count - db.min_recent_review_count, 0)
        END
      )
    ) / NULLIF($1 + $2 + $3 + $4, 0), 0)::float AS value_score
  FROM products p
  JOIN categories c ON p.category_id = c.category_id
  LEFT JOIN brands b ON p.brand_id = b.brand_id
  LEFT JOIN recent_reviews rr ON rr.asin = p.asin
  JOIN product_price_eff ppe ON ppe.asin = p.asin
  CROSS JOIN dimension_bounds db
  WHERE p.price IS NOT NULL
    AND p.stars IS NOT NULL
  ORDER BY value_score DESC NULLS LAST, p.stars DESC NULLS LAST, p.review_count DESC
  LIMIT 100;
`;

module.exports = {
  productExistsQuery,
  searchProductsQuery,
  dealsQuery,
  ratingDistributionQuery,
  helpfulReviewsQuery,
  alternativesQuery,
  trendingProductsQuery,
  topValueProductsQuery,
  valueRankingsQuery,
  productExistsQueryOptimized,
  searchProductsQueryOptimized,
  dealsQueryOptimized,
  ratingDistributionQueryOptimized,
  helpfulReviewsQueryOptimized,
  alternativesQueryOptimized,
  trendingProductsQueryOptimized,
  topValueProductsQueryOptimized,
  valueRankingsQueryOptimized
};
