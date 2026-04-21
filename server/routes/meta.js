const express = require('express');
const pool = require('../db');
const {
  listCategoriesQuery,
  listBrandsQuery,
  getProductDetailQuery
} = require('../queries/meta.sql');

const router = express.Router();

router.get('/categories', async (req, res, next) => {
  try {
    const { rows } = await pool.query(listCategoriesQuery);
    return res.json(rows);
  } catch (err) {
    return next(err);
  }
});

router.get('/brands', async (req, res, next) => {
  try {
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
    const { rows } = await pool.query(getProductDetailQuery, [asin]);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'product not found' });
    }

    return res.json(rows[0]);
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
