const express = require('express');
const pool = require('../db');
const {
  productExistsQuery,
  searchProductsQuery,
  dealsQuery,
  categoryProductsQuery,
  brandProductsQuery,
  ratingDistributionQuery,
  helpfulReviewsQuery,
  alternativesQuery,
  trendingProductsQuery,
  trendingProductsDefaultQuery,
  topValueProductsQuery,
  valueRankingsQuery,
  productExistsQueryOptimized,
  searchProductsQueryOptimized,
  dealsQueryOptimized,
  categoryProductsQueryOptimized,
  brandProductsQueryOptimized,
  ratingDistributionQueryOptimized,
  helpfulReviewsQueryOptimized,
  alternativesQueryOptimized,
  trendingProductsQueryOptimized,
  topValueProductsQueryOptimized,
  valueRankingsQueryOptimized
} = require('../queries/products');

const router = express.Router();
const ASIN_RE = /^[A-Z0-9]{10}$/;
const PRODUCT_CACHE_CONTROL = 'public, max-age=60';

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

function parseIntegerParam(value, name, { defaultValue, min, max } = {}) {
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

  if (max !== undefined && parsed > max) {
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

function validateAsinParam(res, asin) {
  if (!asin) {
    return res.status(400).json({ error: 'missing required param: asin' });
  }

  if (!ASIN_RE.test(asin)) {
    return res.status(400).json({ error: 'invalid param: asin' });
  }

  return null;
}

router.get('/products/search', async (req, res, next) => {
  const { keyword } = req.query;

  if (!keyword) {
    return res.status(400).json({ error: 'missing required param: keyword' });
  }

  if (typeof keyword !== 'string' || keyword.length > 200) {
    return res.status(400).json({ error: 'invalid param: keyword' });
  }

  let minStars;
  let limit;
  let offset;

  try {
    minStars = parseFloatParam(req.query.minStars, 'minStars', {
      defaultValue: 0,
      min: 0,
      max: 5
    });
    limit = parseIntegerParam(req.query.limit, 'limit', {
      defaultValue: null,
      min: 1,
      max: 100
    });
    offset = parseIntegerParam(req.query.offset, 'offset', {
      defaultValue: 0,
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
    const sql = isOptimized(req) ? searchProductsQueryOptimized : searchProductsQuery;
    const { rows } = await pool.query(sql, [keyword, minStars, limit, offset]);
    return res.json(rows);
  } catch (err) {
    return next(err);
  }
});

router.get('/deals', async (req, res, next) => {
  let maxPrice;
  let minStars;
  let limit;
  let offset;

  try {
    maxPrice = parseFloatParam(req.query.maxPrice, 'maxPrice', {
      defaultValue: 500,
      min: 0
    });
    minStars = parseFloatParam(req.query.minStars, 'minStars', {
      defaultValue: 0,
      min: 0,
      max: 5
    });
    limit = parseIntegerParam(req.query.limit, 'limit', {
      defaultValue: null,
      min: 1,
      max: 100
    });
    offset = parseIntegerParam(req.query.offset, 'offset', {
      defaultValue: 0,
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
    const { rows } = await pool.query(sql, [maxPrice, minStars, limit, offset]);
    return res.json(rows);
  } catch (err) {
    return next(err);
  }
});

router.get('/products/category', async (req, res, next) => {
  const { category } = req.query;

  if (!category) {
    return res.status(400).json({ error: 'missing required param: category' });
  }

  if (typeof category !== 'string' || category.length > 255) {
    return res.status(400).json({ error: 'invalid param: category' });
  }

  let minStars;
  let maxPrice;
  let limit;
  let offset;

  try {
    minStars = parseFloatParam(req.query.minStars, 'minStars', {
      defaultValue: 0,
      min: 0,
      max: 5
    });
    maxPrice = parseFloatParam(req.query.maxPrice, 'maxPrice', {
      defaultValue: null,
      min: 0
    });
    limit = parseIntegerParam(req.query.limit, 'limit', {
      defaultValue: 24,
      min: 1,
      max: 100
    });
    offset = parseIntegerParam(req.query.offset, 'offset', {
      defaultValue: 0,
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
    const sql = isOptimized(req) ? categoryProductsQueryOptimized : categoryProductsQuery;
    const { rows } = await pool.query(sql, [category, minStars, maxPrice, limit, offset]);
    return res.json(rows);
  } catch (err) {
    return next(err);
  }
});

router.get('/products/brand', async (req, res, next) => {
  const { brand } = req.query;

  if (!brand) {
    return res.status(400).json({ error: 'missing required param: brand' });
  }

  if (typeof brand !== 'string' || brand.length > 255) {
    return res.status(400).json({ error: 'invalid param: brand' });
  }

  let minStars;
  let maxPrice;
  let limit;
  let offset;

  try {
    minStars = parseFloatParam(req.query.minStars, 'minStars', {
      defaultValue: 0,
      min: 0,
      max: 5
    });
    maxPrice = parseFloatParam(req.query.maxPrice, 'maxPrice', {
      defaultValue: null,
      min: 0
    });
    limit = parseIntegerParam(req.query.limit, 'limit', {
      defaultValue: 24,
      min: 1,
      max: 100
    });
    offset = parseIntegerParam(req.query.offset, 'offset', {
      defaultValue: 0,
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
    const sql = isOptimized(req) ? brandProductsQueryOptimized : brandProductsQuery;
    const { rows } = await pool.query(sql, [brand, minStars, maxPrice, limit, offset]);
    return res.json(rows);
  } catch (err) {
    return next(err);
  }
});

router.get('/products/:asin/rating-distribution', async (req, res, next) => {
  const { asin } = req.params;

  const validationResponse = validateAsinParam(res, asin);
  if (validationResponse) {
    return validationResponse;
  }

  const optimized = isOptimized(req);

  try {
    if (!(await productExists(asin, optimized))) {
      return res.status(404).json({ error: 'product not found' });
    }

    const sql = optimized ? ratingDistributionQueryOptimized : ratingDistributionQuery;
    const { rows } = await pool.query(sql, [asin]);
    res.set('Cache-Control', PRODUCT_CACHE_CONTROL);
    return res.json(rows);
  } catch (err) {
    return next(err);
  }
});

router.get('/products/:asin/helpful-reviews', async (req, res, next) => {
  const { asin } = req.params;

  const validationResponse = validateAsinParam(res, asin);
  if (validationResponse) {
    return validationResponse;
  }

  const optimized = isOptimized(req);

  try {
    if (!(await productExists(asin, optimized))) {
      return res.status(404).json({ error: 'product not found' });
    }

    const sql = optimized ? helpfulReviewsQueryOptimized : helpfulReviewsQuery;
    const { rows } = await pool.query(sql, [asin]);
    res.set('Cache-Control', PRODUCT_CACHE_CONTROL);
    return res.json(rows);
  } catch (err) {
    return next(err);
  }
});

router.get('/products/:asin/alternatives', async (req, res, next) => {
  const { asin } = req.params;

  const validationResponse = validateAsinParam(res, asin);
  if (validationResponse) {
    return validationResponse;
  }

  const optimized = isOptimized(req);

  try {
    if (!(await productExists(asin, optimized))) {
      return res.status(404).json({ error: 'product not found' });
    }

    const sql = optimized ? alternativesQueryOptimized : alternativesQuery;
    const { rows } = await pool.query(sql, [asin]);
    res.set('Cache-Control', PRODUCT_CACHE_CONTROL);
    return res.json(rows);
  } catch (err) {
    return next(err);
  }
});

router.get('/products/trending', async (req, res, next) => {
  const { category } = req.query;
  const hasExplicitMonths = req.query.months !== undefined
    && req.query.months !== null
    && req.query.months !== '';

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
    let sql;
    let params;

    if (hasExplicitMonths) {
      sql = trendingProductsQuery;
      params = [category, months];
    } else if (isOptimized(req)) {
      sql = trendingProductsQueryOptimized;
      params = [category];
    } else {
      sql = trendingProductsDefaultQuery;
      params = [category];
    }

    const { rows } = await pool.query(sql, params);
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

  if (wRating + wReviews + wPriceEff + wRecent === 0) {
    return res.status(400).json({ error: 'invalid param: weights' });
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
