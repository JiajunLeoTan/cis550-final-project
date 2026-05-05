// Category and brand listings share the same "proven products first" sort:
// 4+ stars with at least one review, then other reviewed/high-rated products.

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

// Resolve the category once, page the product table first, then join display
// names only for the rows the UI will show.
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

// Same idea for brands: find the brand ID once, page products, then attach the
// category name for the selected rows.
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

module.exports = {
  categoryProductsQuery,
  brandProductsQuery,
  categoryProductsQueryOptimized,
  brandProductsQueryOptimized
};
