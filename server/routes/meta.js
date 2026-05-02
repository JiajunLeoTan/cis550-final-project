const express = require('express');
const pool = require('../db');
const { cached } = require('../cache');
const {
  listCategoriesQuery,
  listBrandsQuery,
  getProductDetailQuery,
  listCategoriesQueryOptimized,
  listBrandsQueryOptimized,
  getProductDetailQueryOptimized
} = require('../queries/meta.sql');

const router = express.Router();

function isOptimized(req) {
  const v = req.query.optimized;
  return v === '1' || v === 'true';
}

const CACHE_TTL_MS = 60_000;
const LONG_CACHE_CONTROL = 'public, max-age=300, stale-while-revalidate=60';
const PRODUCT_CACHE_CONTROL = 'public, max-age=60';

async function cachedQuery(key, sql) {
  return cached(key, CACHE_TTL_MS, async () => {
    const { rows } = await pool.query(sql);
    return rows;
  });
}

const ASIN_RE = /^[A-Z0-9]{10}$/;

function validateAsinParam(res, asin) {
  if (!asin) {
    return res.status(400).json({ error: 'missing required param: asin' });
  }

  if (!ASIN_RE.test(asin)) {
    return res.status(400).json({ error: 'invalid param: asin' });
  }

  return null;
}

router.get('/categories', async (req, res, next) => {
  try {
    if (isOptimized(req)) {
      const rows = await cachedQuery('meta:categories:optimized', listCategoriesQueryOptimized);
      res.set('Cache-Control', LONG_CACHE_CONTROL);
      return res.json(rows);
    }
    const { rows } = await pool.query(listCategoriesQuery);
    res.set('Cache-Control', LONG_CACHE_CONTROL);
    return res.json(rows);
  } catch (err) {
    return next(err);
  }
});

router.get('/brands', async (req, res, next) => {
  try {
    if (isOptimized(req)) {
      const rows = await cachedQuery('meta:brands:optimized', listBrandsQueryOptimized);
      res.set('Cache-Control', LONG_CACHE_CONTROL);
      return res.json(rows);
    }
    const { rows } = await pool.query(listBrandsQuery);
    res.set('Cache-Control', LONG_CACHE_CONTROL);
    return res.json(rows);
  } catch (err) {
    return next(err);
  }
});

router.get('/products/:asin', async (req, res, next) => {
  const { asin } = req.params;

  const validationResponse = validateAsinParam(res, asin);
  if (validationResponse) {
    return validationResponse;
  }

  try {
    const sql = isOptimized(req) ? getProductDetailQueryOptimized : getProductDetailQuery;
    const { rows } = await pool.query(sql, [asin]);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'product not found' });
    }

    res.set('Cache-Control', PRODUCT_CACHE_CONTROL);
    return res.json(rows[0]);
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
