// Deals are products with a current price below list price, sorted by the size
// of that discount.

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
    AND ($2 = 0 OR COALESCE(p.review_count, 0) > 0)
  ORDER BY (1 - p.price / p.list_price) DESC, p.review_count DESC, p.stars DESC NULLS LAST, p.asin ASC
  LIMIT $3::int OFFSET $4::int;
`;

// The WHERE clause already proves list_price is positive, so the optimized path
// can order by the raw discount expression.
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
    AND ($2 = 0 OR COALESCE(p.review_count, 0) > 0)
  ORDER BY (1 - p.price / p.list_price) DESC, p.review_count DESC, p.stars DESC NULLS LAST, p.asin ASC
  LIMIT COALESCE($3::int, 100) OFFSET $4::int;
`;

module.exports = {
  dealsQuery,
  dealsQueryOptimized
};
