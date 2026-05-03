const { Pool } = require('pg');
const config = require('./config');

const pool = globalThis.__AXIOM_PG_POOL__ || new Pool(config.db);

if (!globalThis.__AXIOM_PG_POOL__) {
  globalThis.__AXIOM_PG_POOL__ = pool;
  pool.on('error', (err) => {
    console.error('Unexpected idle PostgreSQL client error', err);
  });
}

module.exports = pool;
