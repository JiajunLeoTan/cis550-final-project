// Product detail page queries: rating distribution, top helpful reviews, and
// "better and cheaper" alternatives.

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

module.exports = {
  ratingDistributionQuery,
  helpfulReviewsQuery,
  alternativesQuery,
  ratingDistributionQueryOptimized,
  helpfulReviewsQueryOptimized,
  alternativesQueryOptimized
};
