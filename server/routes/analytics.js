const express = require('express');
const pool = require('../db');
const {
  categoriesCompareQuery,
  brandsPerformanceQuery,
  reviewsTrendQuery
} = require('../queries/analytics.sql');

const router = express.Router();

router.get('/analytics/categories/compare', async (req, res, next) => {
  try {
    const { rows } = await pool.query(categoriesCompareQuery);
    return res.json(rows);
  } catch (err) {
    return next(err);
  }
});

router.get('/analytics/brands/performance', async (req, res, next) => {
  try {
    const { rows } = await pool.query(brandsPerformanceQuery);
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
    const { rows } = await pool.query(reviewsTrendQuery, [category]);
    return res.json(rows);
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
