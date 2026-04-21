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

module.exports = {
  listCategoriesQuery,
  listBrandsQuery,
  getProductDetailQuery
};
