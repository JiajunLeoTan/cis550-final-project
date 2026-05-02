const productExistsQuery = `
  SELECT 1
  FROM products
  WHERE asin = $1;
`;

const searchProductsQuery = `
  SELECT
    asin,
    title,
    img_url,
    price::float AS price,
    stars::float AS stars,
    review_count,
    is_best_seller
  FROM products
  WHERE title ILIKE '%' || $1 || '%'
    AND COALESCE(stars, 0) >= $2
  ORDER BY stars DESC NULLS LAST, review_count DESC, title ASC
  LIMIT $3::int OFFSET $4::int;
`;

const dealsQuery = `
  SELECT
    p.asin,
    p.title,
    p.img_url,
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
    AND COALESCE(p.stars, 0) >= $2
  ORDER BY discount_pct DESC NULLS LAST, p.review_count DESC, p.stars DESC NULLS LAST
  LIMIT $3::int OFFSET $4::int;
`;

const categoryProductsQuery = `
  SELECT
    p.asin,
    p.title,
    p.img_url,
    p.price::float AS price,
    p.list_price::float AS list_price,
    CASE
      WHEN p.list_price IS NOT NULL
       AND p.list_price > 0
       AND p.price IS NOT NULL
       AND p.price < p.list_price
      THEN ROUND(((1 - (p.price / p.list_price)) * 100)::numeric, 1)::float
      ELSE NULL
    END AS discount_pct,
    p.stars::float AS stars,
    p.review_count,
    p.is_best_seller,
    c.category_name,
    b.brand_name
  FROM products p
  JOIN categories c ON p.category_id = c.category_id
  LEFT JOIN brands b ON p.brand_id = b.brand_id
  WHERE c.category_name = $1
    AND COALESCE(p.stars, 0) >= $2
    AND ($3::numeric IS NULL OR p.price <= $3)
  ORDER BY
    CASE
      WHEN p.stars >= 4 AND COALESCE(p.review_count, 0) > 0 THEN 0
      WHEN COALESCE(p.review_count, 0) > 0 THEN 1
      WHEN p.stars >= 4 THEN 2
      ELSE 3
    END,
    COALESCE(p.review_count, 0) DESC,
    p.stars DESC NULLS LAST,
    p.is_best_seller DESC,
    p.asin ASC
  LIMIT $4::int OFFSET $5::int;
`;

const brandProductsQuery = `
  SELECT
    p.asin,
    p.title,
    p.img_url,
    p.price::float AS price,
    p.list_price::float AS list_price,
    CASE
      WHEN p.list_price IS NOT NULL
       AND p.list_price > 0
       AND p.price IS NOT NULL
       AND p.price < p.list_price
      THEN ROUND(((1 - (p.price / p.list_price)) * 100)::numeric, 1)::float
      ELSE NULL
    END AS discount_pct,
    p.stars::float AS stars,
    p.review_count,
    p.is_best_seller,
    c.category_name,
    b.brand_name
  FROM products p
  JOIN brands b ON p.brand_id = b.brand_id
  LEFT JOIN categories c ON p.category_id = c.category_id
  WHERE b.brand_name = $1
    AND COALESCE(p.stars, 0) >= $2
    AND ($3::numeric IS NULL OR p.price <= $3)
  ORDER BY
    CASE
      WHEN p.stars >= 4 AND COALESCE(p.review_count, 0) > 0 THEN 0
      WHEN COALESCE(p.review_count, 0) > 0 THEN 1
      WHEN p.stars >= 4 THEN 2
      ELSE 3
    END,
    COALESCE(p.review_count, 0) DESC,
    p.stars DESC NULLS LAST,
    p.is_best_seller DESC,
    p.asin ASC
  LIMIT $4::int OFFSET $5::int;
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
    p.img_url,
    p.price::float AS price,
    p.stars::float AS stars,
    p.review_count,
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

// Depends on idx_products_title_trgm (pg_trgm GIN) for fast substring search.
// LIMIT keeps the UI path bounded after the indexed title filter.
const searchProductsQueryOptimized = `
  SELECT
    asin,
    title,
    img_url,
    price::float AS price,
    stars::float AS stars,
    review_count,
    is_best_seller
  FROM products
  WHERE title ILIKE '%' || $1 || '%'
    AND COALESCE(stars, 0) >= $2
  ORDER BY stars DESC NULLS LAST, review_count DESC, title ASC
  LIMIT COALESCE($3::int, 100) OFFSET $4::int;
`;

// Add LIMIT and drop the dead NULLIF (list_price > 0 is already enforced).
const dealsQueryOptimized = `
  SELECT
    p.asin,
    p.title,
    p.img_url,
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
    AND COALESCE(p.stars, 0) >= $2
  ORDER BY (1 - p.price / p.list_price) DESC, p.review_count DESC, p.stars DESC NULLS LAST
  LIMIT COALESCE($3::int, 100) OFFSET $4::int;
`;

// Resolve the category once, take the proven-product page slice, then join
// display tables only for the selected page. Uses idx_products_category_proven
// when the performance DDL has been applied.
const categoryProductsQueryOptimized = `
  WITH target_category AS (
    SELECT category_id, category_name
    FROM categories
    WHERE category_name = $1
    LIMIT 1
  ),
  page_products AS (
    SELECT
      p.asin,
      p.title,
      p.img_url,
      p.price,
      p.list_price,
      p.stars,
      p.review_count,
      p.is_best_seller,
      p.brand_id
    FROM products p
    JOIN target_category tc ON p.category_id = tc.category_id
    WHERE COALESCE(p.stars, 0) >= $2
      AND ($3::numeric IS NULL OR p.price <= $3)
    ORDER BY
      CASE
        WHEN p.stars >= 4 AND COALESCE(p.review_count, 0) > 0 THEN 0
        WHEN COALESCE(p.review_count, 0) > 0 THEN 1
        WHEN p.stars >= 4 THEN 2
        ELSE 3
      END,
      COALESCE(p.review_count, 0) DESC,
      p.stars DESC NULLS LAST,
      p.is_best_seller DESC,
      p.asin ASC
    LIMIT COALESCE($4::int, 100) OFFSET $5::int
  )
  SELECT
    pp.asin,
    pp.title,
    pp.img_url,
    pp.price::float AS price,
    pp.list_price::float AS list_price,
    CASE
      WHEN pp.list_price IS NOT NULL
       AND pp.list_price > 0
       AND pp.price IS NOT NULL
       AND pp.price < pp.list_price
      THEN ROUND(((1 - (pp.price / pp.list_price)) * 100)::numeric, 1)::float
      ELSE NULL
    END AS discount_pct,
    pp.stars::float AS stars,
    pp.review_count,
    pp.is_best_seller,
    tc.category_name,
    b.brand_name
  FROM page_products pp
  CROSS JOIN target_category tc
  LEFT JOIN brands b ON pp.brand_id = b.brand_id
  ORDER BY
    CASE
      WHEN pp.stars >= 4 AND COALESCE(pp.review_count, 0) > 0 THEN 0
      WHEN COALESCE(pp.review_count, 0) > 0 THEN 1
      WHEN pp.stars >= 4 THEN 2
      ELSE 3
    END,
    COALESCE(pp.review_count, 0) DESC,
    pp.stars DESC NULLS LAST,
    pp.is_best_seller DESC,
    pp.asin ASC;
`;

// Resolve the brand once, take the proven-product page slice, then join
// display tables only for selected rows. Uses idx_products_brand_proven when
// available, and falls back cleanly to idx_products_brand otherwise.
const brandProductsQueryOptimized = `
  WITH target_brand AS (
    SELECT brand_id, brand_name
    FROM brands
    WHERE brand_name = $1
    LIMIT 1
  ),
  page_products AS (
    SELECT
      p.asin,
      p.title,
      p.img_url,
      p.price,
      p.list_price,
      p.stars,
      p.review_count,
      p.is_best_seller,
      p.category_id
    FROM products p
    JOIN target_brand tb ON p.brand_id = tb.brand_id
    WHERE COALESCE(p.stars, 0) >= $2
      AND ($3::numeric IS NULL OR p.price <= $3)
    ORDER BY
      CASE
        WHEN p.stars >= 4 AND COALESCE(p.review_count, 0) > 0 THEN 0
        WHEN COALESCE(p.review_count, 0) > 0 THEN 1
        WHEN p.stars >= 4 THEN 2
        ELSE 3
      END,
      COALESCE(p.review_count, 0) DESC,
      p.stars DESC NULLS LAST,
      p.is_best_seller DESC,
      p.asin ASC
    LIMIT COALESCE($4::int, 100) OFFSET $5::int
  )
  SELECT
    pp.asin,
    pp.title,
    pp.img_url,
    pp.price::float AS price,
    pp.list_price::float AS list_price,
    CASE
      WHEN pp.list_price IS NOT NULL
       AND pp.list_price > 0
       AND pp.price IS NOT NULL
       AND pp.price < pp.list_price
      THEN ROUND(((1 - (pp.price / pp.list_price)) * 100)::numeric, 1)::float
      ELSE NULL
    END AS discount_pct,
    pp.stars::float AS stars,
    pp.review_count,
    pp.is_best_seller,
    c.category_name,
    tb.brand_name
  FROM page_products pp
  CROSS JOIN target_brand tb
  LEFT JOIN categories c ON pp.category_id = c.category_id
  ORDER BY
    CASE
      WHEN pp.stars >= 4 AND COALESCE(pp.review_count, 0) > 0 THEN 0
      WHEN COALESCE(pp.review_count, 0) > 0 THEN 1
      WHEN pp.stars >= 4 THEN 2
      ELSE 3
    END,
    COALESCE(pp.review_count, 0) DESC,
    pp.stars DESC NULLS LAST,
    pp.is_best_seller DESC,
    pp.asin ASC;
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
    p.img_url,
    p.price::float AS price,
    p.stars::float AS stars,
    p.review_count,
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

// Uses mv_value_score_components. The route still accepts reviewedSince, but
// the optimized path uses the materialized view's data-relative 12-month
// review window so top-value can be served without scanning Reviews.
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
  WHERE m.price < m.cat_avg_price
    AND m.stars > m.cat_avg_stars
    AND m.recent_review_count > 0
    AND $1::timestamp IS NOT NULL
  ORDER BY m.stars DESC NULLS LAST, m.review_count DESC, m.price ASC NULLS LAST
  LIMIT 100;
`;

// Uses mv_value_score_components for static normalized inputs. The common
// demo/report weights (0.4/0.2/0.2/0.2) use an indexed precomputed score;
// arbitrary weights fall back to dynamic scoring over the narrow matview.
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
    ORDER BY m.value_score_default DESC NULLS LAST, m.stars DESC NULLS LAST, m.review_count DESC
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
    ORDER BY value_score DESC NULLS LAST, m.stars DESC NULLS LAST, m.review_count DESC
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
  ORDER BY ranked.value_score DESC NULLS LAST, p.stars DESC NULLS LAST, p.review_count DESC
  LIMIT 100;
`;

module.exports = {
  productExistsQuery,
  searchProductsQuery,
  dealsQuery,
  categoryProductsQuery,
  brandProductsQuery,
  ratingDistributionQuery,
  helpfulReviewsQuery,
  alternativesQuery,
  trendingProductsQuery,
  topValueProductsQuery,
  valueRankingsQuery,
  productExistsQueryOptimized,
  searchProductsQueryOptimized,
  dealsQueryOptimized,
  categoryProductsQueryOptimized,
  brandProductsQueryOptimized,
  ratingDistributionQueryOptimized,
  helpfulReviewsQueryOptimized,
  alternativesQueryOptimized,
  trendingProductsQueryOptimized,
  topValueProductsQueryOptimized,
  valueRankingsQueryOptimized
};
