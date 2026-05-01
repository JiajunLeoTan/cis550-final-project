const express = require('express');
const pool = require('../db');
const {
  cartSavingsQuery,
  cartSavingsQueryOptimized
} = require('../queries/cart.sql');

const router = express.Router();

function isOptimized(req) {
  const v = req.query.optimized;
  return v === '1' || v === 'true';
}

router.post('/cart/savings', async (req, res, next) => {
  const { asins } = req.body || {};

  if (asins === undefined) {
    return res.status(400).json({ error: 'missing required param: asins' });
  }

  if (!Array.isArray(asins) || !asins.every((asin) => typeof asin === 'string')) {
    return res.status(400).json({ error: 'invalid param: asins' });
  }

  try {
    const sql = isOptimized(req) ? cartSavingsQueryOptimized : cartSavingsQuery;
    const { rows } = await pool.query(sql, [asins]);
    return res.json(rows[0]);
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
