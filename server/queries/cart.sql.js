const cartSavingsQuery = `
  SELECT
    COALESCE(SUM(COALESCE(list_price, 0)), 0)::float AS total_list_price,
    COALESCE(SUM(COALESCE(price, 0)), 0)::float AS total_current_price,
    COALESCE(SUM(COALESCE(list_price, 0) - COALESCE(price, 0)), 0)::float AS total_savings
  FROM products
  WHERE asin = ANY($1::text[]);
`;

// SUM ignores NULLs natively, so the per-row COALESCE wrappers are wasted
// CPU on every cart item. Only the outer COALESCE for the empty-cart case
// is needed.
const cartSavingsQueryOptimized = `
  SELECT
    COALESCE(SUM(list_price), 0)::float AS total_list_price,
    COALESCE(SUM(price), 0)::float AS total_current_price,
    COALESCE(SUM(list_price) - SUM(price), 0)::float AS total_savings
  FROM products
  WHERE asin = ANY($1::text[]);
`;

module.exports = {
  cartSavingsQuery,
  cartSavingsQueryOptimized
};
