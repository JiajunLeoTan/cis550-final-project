const fs = require('fs');
const path = require('path');
const pool = require('../server/db');

(async () => {
  const sql = fs.readFileSync(
    path.resolve(__dirname, '../database/refresh_matviews.sql'),
    'utf8'
  );

  const t0 = Date.now();
  await pool.query(sql);
  console.log(`refreshed in ${Date.now() - t0} ms`);
})()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
