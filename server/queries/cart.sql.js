const cartSavingsQuery = `
  SELECT
    COALESCE(SUM(COALESCE(list_price, 0)), 0)::float AS total_list_price,
    COALESCE(SUM(COALESCE(price, 0)), 0)::float AS total_current_price,
    COALESCE(SUM(COALESCE(list_price, 0) - COALESCE(price, 0)), 0)::float AS total_savings
  FROM products
  WHERE asin = ANY($1::text[]);
`;

module.exports = {
  cartSavingsQuery
};
