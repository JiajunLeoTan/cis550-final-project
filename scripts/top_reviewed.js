const pool = require('../server/db');

(async () => {
  const top = await pool.query(`
    SELECT r.asin, COUNT(*)::int AS reviews, LEFT(p.title, 60) AS title,
           p.stars::float AS stars,
           MIN(r.review_timestamp) AS first_ts,
           MAX(r.review_timestamp) AS last_ts
    FROM reviews r JOIN products p ON p.asin = r.asin
    GROUP BY r.asin, p.title, p.stars
    ORDER BY reviews DESC LIMIT 8;`);
  console.log('TOP REVIEWED PRODUCTS:');
  console.log(JSON.stringify(top.rows, null, 2));

  const distinct = await pool.query(
    `SELECT COUNT(DISTINCT asin)::int AS distinct_asins FROM reviews;`
  );
  console.log('\nDistinct ASINs w/ any review:', distinct.rows[0]);

  const ts = await pool.query(
    `SELECT MIN(review_timestamp) AS oldest, MAX(review_timestamp) AS newest FROM reviews;`
  );
  console.log('Review timestamp range:', ts.rows[0]);

  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
