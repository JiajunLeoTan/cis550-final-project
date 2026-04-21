const path = require('path');
const express = require('express');
const cors = require('cors');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const config = require('./config');
const productRoutes = require('./routes/products');
const analyticsRoutes = require('./routes/analytics');
const cartRoutes = require('./routes/cart');
const metaRoutes = require('./routes/meta');

const app = express();

app.use(cors());
app.use(express.json());

app.use('/', productRoutes);
app.use('/', analyticsRoutes);
app.use('/', cartRoutes);
app.use('/', metaRoutes);

app.use((err, req, res, next) => {
  console.error(err);

  if (res.headersSent) {
    return next(err);
  }

  return res.status(500).json({ error: 'Internal server error' });
});

app.listen(config.port, () => {
  console.log(`Server on :${config.port}`);
});
