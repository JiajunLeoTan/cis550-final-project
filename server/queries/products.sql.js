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

module.exports = {
  productExistsQuery,
  searchProductsQuery,
  dealsQuery,
  ratingDistributionQuery,
  helpfulReviewsQuery,
  alternativesQuery,
  trendingProductsQuery,
  topValueProductsQuery,
  valueRankingsQuery
};
