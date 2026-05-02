const express = require('express');
const pool = require('../db');
const { cached } = require('../cache');
const {
  categoriesCompareQuery,
  brandsPerformanceQuery,
  reviewsTrendQuery,
  categoriesCompareQueryOptimized,
  brandsPerformanceQueryOptimized,
  reviewsTrendQueryOptimized
} = require('../queries/analytics.sql');

const router = express.Router();
const CACHE_TTL_MS = 5 * 60_000;
const CACHE_CONTROL = 'public, max-age=300, stale-while-revalidate=60';
const CACHE_SCHEMA_VERSION = 'v3';

function isOptimized(req) {
  const v = req.query.optimized;
  return v === '1' || v === 'true';
}

async function queryRows(sql, params = []) {
  const { rows } = await pool.query(sql, params);
  return rows;
}

router.get('/analytics/categories/compare', async (req, res, next) => {
  try {
    const optimized = isOptimized(req);
    const sql = optimized ? categoriesCompareQueryOptimized : categoriesCompareQuery;
    const rows = optimized
      ? await cached(`analytics:${CACHE_SCHEMA_VERSION}:categories:compare:optimized`, CACHE_TTL_MS, () => queryRows(sql))
      : await queryRows(sql);
    res.set('Cache-Control', CACHE_CONTROL);
    return res.json(rows);
  } catch (err) {
    return next(err);
  }
});

router.get('/analytics/brands/performance', async (req, res, next) => {
  try {
    const optimized = isOptimized(req);
    const sql = optimized ? brandsPerformanceQueryOptimized : brandsPerformanceQuery;
    const rows = await queryRows(sql);
    res.set('Cache-Control', 'no-store');
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
    const optimized = isOptimized(req);
    const sql = optimized ? reviewsTrendQueryOptimized : reviewsTrendQuery;
    const rows = optimized
      ? await cached(
        `analytics:${CACHE_SCHEMA_VERSION}:reviews:trend:optimized:${category}`,
        CACHE_TTL_MS,
        () => queryRows(sql, [category])
      )
      : await queryRows(sql, [category]);
    res.set('Cache-Control', CACHE_CONTROL);
    return res.json(rows);
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
