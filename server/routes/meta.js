const express = require('express');
const pool = require('../db');
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
const cache = new Map();

async function cachedQuery(key, sql) {
  const hit = cache.get(key);
  const now = Date.now();
  if (hit && now - hit.at < CACHE_TTL_MS) {
    return hit.rows;
  }
  const { rows } = await pool.query(sql);
  cache.set(key, { rows, at: now });
  return rows;
}

router.get('/categories', async (req, res, next) => {
  try {
    if (isOptimized(req)) {
      const rows = await cachedQuery('categories', listCategoriesQueryOptimized);
      return res.json(rows);
    }
    const { rows } = await pool.query(listCategoriesQuery);
    return res.json(rows);
  } catch (err) {
    return next(err);
  }
});

router.get('/brands', async (req, res, next) => {
  try {
    if (isOptimized(req)) {
      const rows = await cachedQuery('brands', listBrandsQueryOptimized);
      return res.json(rows);
    }
    const { rows } = await pool.query(listBrandsQuery);
    return res.json(rows);
  } catch (err) {
    return next(err);
  }
});

router.get('/products/:asin', async (req, res, next) => {
  const { asin } = req.params;

  if (!asin) {
    return res.status(400).json({ error: 'missing required param: asin' });
  }

  try {
    const sql = isOptimized(req) ? getProductDetailQueryOptimized : getProductDetailQuery;
    const { rows } = await pool.query(sql, [asin]);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'product not found' });
    }

    return res.json(rows[0]);
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
