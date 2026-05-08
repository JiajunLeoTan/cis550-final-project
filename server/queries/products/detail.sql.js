// Product-detail side panels: rating distribution, helpful reviews, and
// alternatives. Alternatives prefer cheaper, higher-rated products when the
// target has a reliable rating; otherwise they fall back to cheaper products.

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
      review_count,
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
    AND t.price > 0
    AND p.price IS NOT NULL
    AND p.price > 0
    AND p.price < t.price
    AND (
      (
        t.stars IS NOT NULL
        AND COALESCE(t.review_count, 0) > 0
        AND p.stars IS NOT NULL
        AND COALESCE(p.review_count, 0) > 0
        AND p.stars > t.stars
      )
      OR t.stars IS NULL
      OR COALESCE(t.review_count, 0) <= 0
    )
  ORDER BY
    CASE
      WHEN t.stars IS NOT NULL AND COALESCE(t.review_count, 0) > 0 THEN p.stars
      ELSE NULL
    END DESC NULLS LAST,
    p.price ASC NULLS LAST,
    p.review_count DESC,
    p.stars DESC NULLS LAST,
    p.asin ASC
  LIMIT 5;
`;

// Count actual ratings first, then add missing 1-5 buckets for the chart.
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

// Rank the product's reviews first, then calculate reviewer stats for only the
// small set that will be displayed.
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

// The target product is a primary-key lookup, then candidates use the same
// rating-aware comparison/fallback as the original path.
const alternativesQueryOptimized = `
  WITH target AS (
    SELECT
      asin,
      category_id,
      stars,
      review_count,
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
    AND t.price > 0
    AND p.price IS NOT NULL
    AND p.price > 0
    AND p.price < t.price
    AND (
      (
        t.stars IS NOT NULL
        AND COALESCE(t.review_count, 0) > 0
        AND p.stars IS NOT NULL
        AND COALESCE(p.review_count, 0) > 0
        AND p.stars > t.stars
      )
      OR t.stars IS NULL
      OR COALESCE(t.review_count, 0) <= 0
    )
  ORDER BY
    CASE
      WHEN t.stars IS NOT NULL AND COALESCE(t.review_count, 0) > 0 THEN p.stars
      ELSE NULL
    END DESC NULLS LAST,
    p.price ASC NULLS LAST,
    p.review_count DESC,
    p.stars DESC NULLS LAST,
    p.asin ASC
  LIMIT 5;
`;

module.exports = {
  ratingDistributionQuery,
  helpfulReviewsQuery,
  alternativesQuery,
  ratingDistributionQueryOptimized,
  helpfulReviewsQueryOptimized,
  alternativesQueryOptimized
};
