// Deals page: products currently priced below their list price, ordered by
// discount percentage.

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

module.exports = {
  dealsQuery,
  dealsQueryOptimized
};
