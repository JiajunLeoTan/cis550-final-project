const express = require('express');
const pool = require('../db');
const {
  productExistsQuery,
  searchProductsQuery,
  dealsQuery,
  ratingDistributionQuery,
  helpfulReviewsQuery,
  alternativesQuery,
  trendingProductsQuery,
  topValueProductsQuery,
  valueRankingsQuery,
  productExistsQueryOptimized,
  searchProductsQueryOptimized,
  dealsQueryOptimized,
  ratingDistributionQueryOptimized,
  helpfulReviewsQueryOptimized,
  alternativesQueryOptimized,
  trendingProductsQueryOptimized,
  topValueProductsQueryOptimized,
  valueRankingsQueryOptimized
} = require('../queries/products.sql');

const router = express.Router();

function isOptimized(req) {
  const v = req.query.optimized;
  return v === '1' || v === 'true';
}

function parseFloatParam(value, name, { defaultValue, min, max } = {}) {
  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`invalid param: ${name}`);
  }

  if (min !== undefined && parsed < min) {
    throw new Error(`invalid param: ${name}`);
  }

  if (max !== undefined && parsed > max) {
    throw new Error(`invalid param: ${name}`);
  }

  return parsed;
}

function parseIntegerParam(value, name, { defaultValue, min } = {}) {
  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed)) {
    throw new Error(`invalid param: ${name}`);
  }

  if (min !== undefined && parsed < min) {
    throw new Error(`invalid param: ${name}`);
  }

  return parsed;
}

function parseReviewedSince(value) {
  if (!value) {
    const defaultDate = new Date();
    defaultDate.setMonth(defaultDate.getMonth() - 12);
    return defaultDate.toISOString();
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error('invalid param: reviewedSince');
  }

  return parsed.toISOString();
}

async function productExists(asin, optimized) {
  const sql = optimized ? productExistsQueryOptimized : productExistsQuery;
  const { rowCount } = await pool.query(sql, [asin]);
  return rowCount > 0;
}

function handleValidationError(res, err) {
  if (err instanceof Error && err.message.startsWith('invalid param:')) {
    return res.status(400).json({ error: err.message });
  }

  throw err;
}

router.get('/products/search', async (req, res, next) => {
  const { keyword } = req.query;

  if (!keyword) {
    return res.status(400).json({ error: 'missing required param: keyword' });
  }

  let minStars;

  try {
    minStars = parseFloatParam(req.query.minStars, 'minStars', {
      defaultValue: 0,
      min: 0,
      max: 5
    });
  } catch (err) {
    try {
      return handleValidationError(res, err);
    } catch (handledErr) {
      return next(handledErr);
    }
  }

  try {
    const sql = isOptimized(req) ? searchProductsQueryOptimized : searchProductsQuery;
    const { rows } = await pool.query(sql, [keyword, minStars]);
    return res.json(rows);
  } catch (err) {
    return next(err);
  }
});

router.get('/deals', async (req, res, next) => {
  let maxPrice;

  try {
    maxPrice = parseFloatParam(req.query.maxPrice, 'maxPrice', {
      defaultValue: 500,
      min: 0
    });
  } catch (err) {
    try {
      return handleValidationError(res, err);
    } catch (handledErr) {
      return next(handledErr);
    }
  }

  try {
    const sql = isOptimized(req) ? dealsQueryOptimized : dealsQuery;
    const { rows } = await pool.query(sql, [maxPrice]);
    return res.json(rows);
  } catch (err) {
    return next(err);
  }
});

router.get('/products/:asin/rating-distribution', async (req, res, next) => {
  const { asin } = req.params;

  if (!asin) {
    return res.status(400).json({ error: 'missing required param: asin' });
  }

  const optimized = isOptimized(req);

  try {
    if (!(await productExists(asin, optimized))) {
      return res.status(404).json({ error: 'product not found' });
    }

    const sql = optimized ? ratingDistributionQueryOptimized : ratingDistributionQuery;
    const { rows } = await pool.query(sql, [asin]);
    return res.json(rows);
  } catch (err) {
    return next(err);
  }
});

router.get('/products/:asin/helpful-reviews', async (req, res, next) => {
  const { asin } = req.params;

  if (!asin) {
    return res.status(400).json({ error: 'missing required param: asin' });
  }

  const optimized = isOptimized(req);

  try {
    if (!(await productExists(asin, optimized))) {
      return res.status(404).json({ error: 'product not found' });
    }

    const sql = optimized ? helpfulReviewsQueryOptimized : helpfulReviewsQuery;
    const { rows } = await pool.query(sql, [asin]);
    return res.json(rows);
  } catch (err) {
    return next(err);
  }
});

router.get('/products/:asin/alternatives', async (req, res, next) => {
  const { asin } = req.params;

  if (!asin) {
    return res.status(400).json({ error: 'missing required param: asin' });
  }

  const optimized = isOptimized(req);

  try {
    if (!(await productExists(asin, optimized))) {
      return res.status(404).json({ error: 'product not found' });
    }

    const sql = optimized ? alternativesQueryOptimized : alternativesQuery;
    const { rows } = await pool.query(sql, [asin]);
    return res.json(rows);
  } catch (err) {
    return next(err);
  }
});

router.get('/products/trending', async (req, res, next) => {
  const { category } = req.query;

  if (!category) {
    return res.status(400).json({ error: 'missing required param: category' });
  }

  let months;

  try {
    months = parseIntegerParam(req.query.months, 'months', {
      defaultValue: 3,
      min: 1
    });
  } catch (err) {
    try {
      return handleValidationError(res, err);
    } catch (handledErr) {
      return next(handledErr);
    }
  }

  try {
    const sql = isOptimized(req) ? trendingProductsQueryOptimized : trendingProductsQuery;
    const { rows } = await pool.query(sql, [category, months]);
    return res.json(rows);
  } catch (err) {
    return next(err);
  }
});

router.get('/products/top-value', async (req, res, next) => {
  let reviewedSince;

  try {
    reviewedSince = parseReviewedSince(req.query.reviewedSince);
  } catch (err) {
    try {
      return handleValidationError(res, err);
    } catch (handledErr) {
      return next(handledErr);
    }
  }

  try {
    const sql = isOptimized(req) ? topValueProductsQueryOptimized : topValueProductsQuery;
    const { rows } = await pool.query(sql, [reviewedSince]);
    return res.json(rows);
  } catch (err) {
    return next(err);
  }
});

router.get('/products/value-rankings', async (req, res, next) => {
  let wRating;
  let wReviews;
  let wPriceEff;
  let wRecent;

  try {
    wRating = parseFloatParam(req.query.wRating, 'wRating', {
      defaultValue: 0.25,
      min: 0
    });
    wReviews = parseFloatParam(req.query.wReviews, 'wReviews', {
      defaultValue: 0.25,
      min: 0
    });
    wPriceEff = parseFloatParam(req.query.wPriceEff, 'wPriceEff', {
      defaultValue: 0.25,
      min: 0
    });
    wRecent = parseFloatParam(req.query.wRecent, 'wRecent', {
      defaultValue: 0.25,
      min: 0
    });
  } catch (err) {
    try {
      return handleValidationError(res, err);
    } catch (handledErr) {
      return next(handledErr);
    }
  }

  try {
    const sql = isOptimized(req) ? valueRankingsQueryOptimized : valueRankingsQuery;
    const { rows } = await pool.query(sql, [
      wRating,
      wReviews,
      wPriceEff,
      wRecent
    ]);
    return res.json(rows);
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
