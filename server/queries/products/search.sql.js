// Product existence check (used by routes that need a 404 vs 200 distinction
// before running heavier joins) and the storefront search-by-title query.

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

module.exports = {
  productExistsQuery,
  searchProductsQuery,
  productExistsQueryOptimized,
  searchProductsQueryOptimized
};
