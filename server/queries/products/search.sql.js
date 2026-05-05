// Product lookup helpers for routes that need a clear 404 before doing heavier
// product-specific work, plus the storefront title search.

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

// The existence route only needs to know whether one row is present.
const productExistsQueryOptimized = `
  SELECT 1
  FROM products
  WHERE asin = $1
  LIMIT 1;
`;

// The trigram index makes substring search usable over the large product table.
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
