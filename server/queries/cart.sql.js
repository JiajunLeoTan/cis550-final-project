const cartSavingsQuery = `
  SELECT
    COALESCE(SUM(CASE WHEN list_price > 0 THEN list_price ELSE 0 END), 0)::float AS total_list_price,
    COALESCE(SUM(CASE WHEN price > 0 THEN price ELSE 0 END), 0)::float AS total_current_price,
    COALESCE(SUM(
      CASE
        WHEN list_price > 0 AND price > 0 AND list_price > price
        THEN list_price - price
        ELSE 0
      END
    ), 0)::float AS total_savings
  FROM products
  WHERE asin = ANY($1::text[]);
`;

const cartSavingsQueryOptimized = `
  SELECT
    COALESCE(SUM(CASE WHEN list_price > 0 THEN list_price ELSE 0 END), 0)::float AS total_list_price,
    COALESCE(SUM(CASE WHEN price > 0 THEN price ELSE 0 END), 0)::float AS total_current_price,
    COALESCE(SUM(
      CASE
        WHEN list_price > 0 AND price > 0 AND list_price > price
        THEN list_price - price
        ELSE 0
      END
    ), 0)::float AS total_savings
  FROM products
  WHERE asin = ANY($1::text[]);
`;

module.exports = {
  cartSavingsQuery,
  cartSavingsQueryOptimized
};
