const listCategoriesQuery = `
  SELECT
    category_id,
    category_name
  FROM categories
  ORDER BY category_name ASC;
`;

const listBrandsQuery = `
  SELECT
    brand_id,
    brand_name
  FROM brands
  ORDER BY brand_name ASC;
`;

const getProductDetailQuery = `
  SELECT
    p.asin,
    p.title,
    p.img_url,
    p.product_url,
    p.price::float AS price,
    p.list_price::float AS list_price,
    p.stars::float AS stars,
    p.review_count,
    p.is_best_seller,
    c.category_name,
    b.brand_name
  FROM products p
  LEFT JOIN categories c ON p.category_id = c.category_id
  LEFT JOIN brands b ON p.brand_id = b.brand_id
  WHERE p.asin = $1;
`;

// --- Optimised variants ---
// listCategories / listBrands SQL is unchanged (already a tiny index-ordered
// scan); the optimised path uses a route-level in-memory cache so most
// requests skip the DB roundtrip entirely.
const listCategoriesQueryOptimized = listCategoriesQuery;
const listBrandsQueryOptimized = listBrandsQuery;

// Replace the two LEFT JOINs with scalar subqueries. For a single-row PK
// lookup this avoids the join setup and lets the planner do two extra PK
// seeks on the small lookup tables.
const getProductDetailQueryOptimized = `
  SELECT
    p.asin,
    p.title,
    p.img_url,
    p.product_url,
    p.price::float AS price,
    p.list_price::float AS list_price,
    p.stars::float AS stars,
    p.review_count,
    p.is_best_seller,
    (SELECT category_name FROM categories WHERE category_id = p.category_id) AS category_name,
    (SELECT brand_name FROM brands WHERE brand_id = p.brand_id) AS brand_name
  FROM products p
  WHERE p.asin = $1;
`;

module.exports = {
  listCategoriesQuery,
  listBrandsQuery,
  getProductDetailQuery,
  listCategoriesQueryOptimized,
  listBrandsQueryOptimized,
  getProductDetailQueryOptimized
};
