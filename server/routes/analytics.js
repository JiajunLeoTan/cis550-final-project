const express = require('express');
const pool = require('../db');
const {
  categoriesCompareQuery,
  brandsPerformanceQuery,
  reviewsTrendQuery,
  categoriesCompareQueryOptimized,
  brandsPerformanceQueryOptimized,
  reviewsTrendQueryOptimized
} = require('../queries/analytics.sql');

const router = express.Router();

function isOptimized(req) {
  const v = req.query.optimized;
  return v === '1' || v === 'true';
}

router.get('/analytics/categories/compare', async (req, res, next) => {
  try {
    const sql = isOptimized(req) ? categoriesCompareQueryOptimized : categoriesCompareQuery;
    const { rows } = await pool.query(sql);
    return res.json(rows);
  } catch (err) {
    return next(err);
  }
});

router.get('/analytics/brands/performance', async (req, res, next) => {
  try {
    const sql = isOptimized(req) ? brandsPerformanceQueryOptimized : brandsPerformanceQuery;
    const { rows } = await pool.query(sql);
    return res.json(rows);
  } catch (err) {
    return next(err);
  }
});

router.get('/analytics/reviews/trend', async (req, res, next) => {
  const { category } = req.query;

  if (!category) {
    return res.status(400).json({ error: 'missing required param: category' });
  }

  try {
    const sql = isOptimized(req) ? reviewsTrendQueryOptimized : reviewsTrendQuery;
    const { rows } = await pool.query(sql, [category]);
    return res.json(rows);
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
