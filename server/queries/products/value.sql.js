// Value-ranking queries. The original versions do the scoring work live; the
// optimized versions read the same ingredients from mv_value_score_components.

const topValueProductsQuery = `
  -- Intentionally left as correlated subqueries so Milestone 5 can optimize it later.
  SELECT
    p.asin,
    p.title,
    p.img_url,
    p.price::float AS price,
    p.stars::float AS stars,
    p.review_count,
    c.category_name
  FROM products p
  JOIN categories c ON p.category_id = c.category_id
  WHERE p.price IS NOT NULL
    AND p.price > 0
    AND p.stars IS NOT NULL
    AND p.price < (
      SELECT AVG(p2.price)
      FROM products p2
      WHERE p2.category_id = p.category_id
        AND p2.price IS NOT NULL
        AND p2.price > 0
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
  ORDER BY p.stars DESC NULLS LAST, p.review_count DESC, p.price ASC NULLS LAST, p.asin ASC
  LIMIT 100;
`;

const valueRankingsQuery = `
  -- Intentionally duplicates expensive scans so the optimization pass has a meaningful baseline.
  WITH review_horizon AS (
    SELECT COALESCE(MAX(review_timestamp), NOW()) - INTERVAL '12 months' AS start_at
    FROM reviews
  ),
  recent_reviews AS (
    SELECT
      r.asin,
      COUNT(*)::int AS recent_review_count
    FROM reviews r
    CROSS JOIN review_horizon h
    WHERE r.review_timestamp >= h.start_at
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
        AND price > 0
        AND stars IS NOT NULL
      GROUP BY category_id
    ) category_price_bounds ON category_price_bounds.category_id = p.category_id
    WHERE p.price IS NOT NULL
      AND p.price > 0
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
      AND price > 0
      AND stars IS NOT NULL
    GROUP BY category_id
  ) category_price_bounds ON category_price_bounds.category_id = p.category_id
  CROSS JOIN dimension_bounds db
  WHERE p.price IS NOT NULL
    AND p.price > 0
    AND p.stars IS NOT NULL
  ORDER BY value_score DESC NULLS LAST, p.stars DESC NULLS LAST, p.review_count DESC, p.asin ASC
  LIMIT 100;
`;

// The materialized view stores each product's latest review timestamp, so the
// optimized path can honor the route's reviewedSince contract.
const topValueProductsQueryOptimized = `
  SELECT
    m.asin,
    p.title,
    p.img_url,
    m.price::float AS price,
    m.stars::float AS stars,
    m.review_count::int AS review_count,
    c.category_name
  FROM mv_value_score_components m
  JOIN products p ON p.asin = m.asin
  JOIN categories c ON c.category_id = m.category_id
  WHERE m.price > 0
    AND m.cat_avg_price > 0
    AND m.price < m.cat_avg_price
    AND m.stars > m.cat_avg_stars
    AND m.latest_review_timestamp >= $1::timestamp
  ORDER BY m.stars DESC NULLS LAST, m.review_count DESC, m.price ASC NULLS LAST, m.asin ASC
  LIMIT 100;
`;

// Default demo weights can use the indexed precomputed score. Custom weights
// still re-score, but over the narrow materialized view instead of base tables.
const valueRankingsQueryOptimized = `
  WITH default_weighted AS (
    SELECT
      m.asin,
      m.category_id,
      m.brand_id,
      m.price,
      m.stars,
      m.review_count,
      m.recent_review_count,
      m.value_score_default AS value_score
    FROM mv_value_score_components m
    WHERE $1::float = 0.4
      AND $2::float = 0.2
      AND $3::float = 0.2
      AND $4::float = 0.2
      AND m.price > 0
    ORDER BY m.value_score_default DESC NULLS LAST, m.stars DESC NULLS LAST, m.review_count DESC, m.asin ASC
    LIMIT 100
  ),
  dynamic_weighted AS (
    SELECT
      m.asin,
      m.category_id,
      m.brand_id,
      m.price,
      m.stars,
      m.review_count,
      m.recent_review_count,
      COALESCE((
        ($1 * m.norm_stars)
        + ($2 * m.norm_review_count)
        + ($3 * m.norm_price_efficiency)
        + ($4 * m.norm_recent_review_count)
      ) / NULLIF($1 + $2 + $3 + $4, 0), 0)::float AS value_score
    FROM mv_value_score_components m
    WHERE NOT (
      $1::float = 0.4
      AND $2::float = 0.2
      AND $3::float = 0.2
      AND $4::float = 0.2
    )
      AND m.price > 0
    ORDER BY value_score DESC NULLS LAST, m.stars DESC NULLS LAST, m.review_count DESC, m.asin ASC
    LIMIT 100
  ),
  ranked AS (
    SELECT * FROM default_weighted
    UNION ALL
    SELECT * FROM dynamic_weighted
  )
  SELECT
    ranked.asin,
    p.title,
    ranked.price::float AS price,
    ranked.stars::float AS stars,
    ranked.review_count::int AS review_count,
    ranked.recent_review_count::int AS recent_review_count,
    p.img_url,
    c.category_name,
    b.brand_name,
    ranked.value_score
  FROM ranked
  JOIN products p ON p.asin = ranked.asin
  JOIN categories c ON p.category_id = c.category_id
  LEFT JOIN brands b ON p.brand_id = b.brand_id
  ORDER BY ranked.value_score DESC NULLS LAST, p.stars DESC NULLS LAST, p.review_count DESC, ranked.asin ASC
  LIMIT 100;
`;

module.exports = {
  topValueProductsQuery,
  valueRankingsQuery,
  topValueProductsQueryOptimized,
  valueRankingsQueryOptimized
};
