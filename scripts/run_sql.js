const fs = require('fs');
const path = require('path');
const pool = require('../server/db');

async function main() {
  const sqlPath = process.argv[2];
  if (!sqlPath) {
    throw new Error('usage: node scripts/run_sql.js <path-to-sql>');
  }

  const absolutePath = path.resolve(process.cwd(), sqlPath);
  const sql = fs.readFileSync(absolutePath, 'utf8');
  const t0 = Date.now();
  await pool.query(sql);
  console.log(`applied ${sqlPath} in ${Date.now() - t0} ms`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
