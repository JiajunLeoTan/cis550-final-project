# CIS 5500 Performance Optimization Plan

You are picking up the Axiom Shopping Assistant repo at
`/home/leo/dev/school/cis550-final-project`. The 15 routes work end-to-end with
both `?optimized=0` and `?optimized=1`. Original SQL variants must be preserved
so the timing comparison stays valid. The current optimized timings are in
`docs/timings.md`; some queries are within noise of the original (2 runs only)
and two of them (`/products/search`, `/analytics/categories/compare`) actually
came in slightly slower. This plan closes those gaps and makes each complex
query show a clean ≥10x improvement.

## Ground rules

- Do NOT delete or alter any `*Query` (unoptimized) export. The benchmark
  compares it against the `*QueryOptimized` variant.
- Do NOT change the public route surface (paths, params, response shape).
- Every new index, extension, and materialized view goes in
  `scripts/schema.sql` so the schema is reproducible from a clean RDS.
- Apply DDL on the live RDS database after editing `schema.sql`. Use plain
  `psql` or `node scripts/run_sql.js <path>` (create that helper if it does
  not already exist; reuse `server/db.js` for the connection).
- Run `node scripts/benchmark.js --phase post-perf --baseline pre-index` after
  each step so timings.md keeps moving.
- Use `EXPLAIN ANALYZE` to confirm the planner is using the new index/matview
  before you call a step done. Save the EXPLAIN output for the report.

## Files you will touch

| File | Why |
|---|---|
| `scripts/schema.sql` | New extension, indexes, matviews, refresh helper |
| `scripts/refresh_matviews.sql` (new) | Single script the report can reference |
| `server/queries/products.sql.js` | Optimized variants for search, deals, top-value, value-rankings |
| `server/queries/analytics.sql.js` | Optimized variants for brand-perf, categories-compare |
| `server/routes/products.js` | Optional: `Cache-Control` headers on stable endpoints |
| `server/routes/analytics.js` | `Cache-Control` headers on analytics endpoints |
| `server/routes/meta.js` | `Cache-Control` headers on `/categories`, `/brands` |
| `scripts/benchmark.js` | Bump iteration count, add EXPLAIN-cost capture if missing |
| `docs/timings.md` | Regenerate after every step |

────────────────────────────────────────────────
## Step 1 — pg_trgm GIN index for `/products/search` (highest ROI)
────────────────────────────────────────────────

Goal: turn `ILIKE '%keyword%'` from a seq scan over 1.4M titles into a GIN
bitmap scan. Expected: ~2500 ms median → ~50 ms median.

1. In `scripts/schema.sql`, after the existing `CREATE INDEX` block, add:

   ```sql
   CREATE EXTENSION IF NOT EXISTS pg_trgm;
   CREATE INDEX IF NOT EXISTS idx_products_title_trgm
     ON Products USING GIN (title gin_trgm_ops);
   ```

2. Apply it on the live RDS instance. The index build on 1.4M rows takes a
   few minutes — fine. Use `CREATE INDEX CONCURRENTLY` if you want to avoid
   blocking writes; for the schema file leave it as plain `CREATE INDEX` for
   reproducibility.

3. Edit `server/queries/products.sql.js`. The `searchProductsQueryOptimized`
   stays structurally identical (`WHERE title ILIKE '%' || $1 || '%' AND ...
   ORDER BY ... LIMIT 100`), but you should:

   - Verify with `EXPLAIN ANALYZE` that the plan now contains
     `Bitmap Index Scan on idx_products_title_trgm`. If it shows
     `Seq Scan on products`, the planner thought the seq scan was cheaper —
     run `ANALYZE products;` and try again.
   - Add a brief comment above `searchProductsQueryOptimized` explaining the
     trigram index dependency.

4. Run the benchmark with `keyword=makone, minStars=4` (the existing input)
   and confirm the median drops below 100 ms.

5. Verify the unoptimized variant still uses the seq scan (no `idx_products_title_trgm`).
   If the planner picks the trigram index for both variants, the timing
   comparison becomes meaningless. Either:
     - leave it alone (the planner is fine choosing the same plan, the
       optimization story is "we added the index"), or
     - in the unoptimized variant, force a seq scan with
       `WHERE title COLLATE "C" ILIKE ...` or set
       `enable_bitmapscan=off` per-query via a hint comment. Do NOT touch
       `pg_settings` server-wide.
   The safer move is the first option; just narrate it as "the unoptimized
   variant exists for the structural diff; the win comes from the index."

────────────────────────────────────────────────
## Step 2 — Partial expression index on `/deals`
────────────────────────────────────────────────

Goal: avoid sorting all eligible products by computed discount_pct.
Expected: ~2200 ms → ~150 ms.

1. In `scripts/schema.sql` append:

   ```sql
   CREATE INDEX IF NOT EXISTS idx_products_discount
     ON Products (((1 - price/list_price)) DESC, review_count DESC, stars DESC)
     WHERE list_price IS NOT NULL
       AND list_price > 0
       AND price IS NOT NULL
       AND price < list_price;
   ```

   The leading expression matches `discount_pct` (modulo the `*100` constant),
   the secondary keys match the existing tiebreakers. The partial WHERE means
   the index only stores eligible deals — the index is small and the planner
   can skip the WHERE evaluation.

2. Edit `dealsQueryOptimized`. It already has the right WHERE clauses; just
   make sure the ORDER BY exactly matches the index column order:

   ```sql
   ORDER BY (1 - price/list_price) DESC, review_count DESC, stars DESC NULLS LAST
   LIMIT 100
   ```

   (Drop the `NULLIF(p.list_price, 0)` from the ORDER BY expression — the
   partial index already excludes `list_price = 0` so `NULLIF` is no longer
   needed for safety. Keep the `ROUND(...)` only in the SELECT projection,
   not in the ORDER BY, otherwise the ordering expression won't match the
   index expression and the planner falls back to a sort.)

3. Apply DDL. Run `EXPLAIN ANALYZE` to confirm `Index Scan using
   idx_products_discount`. If you see a Sort node, the ORDER BY does not
   match the index — fix it.

4. Run the benchmark. Median should drop under 250 ms.

────────────────────────────────────────────────
## Step 3 — Materialized view for `mv_value_score_components`
────────────────────────────────────────────────

Goal: precompute the per-product narrow components used by both
`/products/value-rankings` and `/products/top-value`. The user's four
weights still apply at query time, so the matview does NOT precompute the
final score — only the static normalized inputs.

Expected: value-rankings 5500 ms → ~100 ms; top-value 450 ms → ~60 ms.

1. In `scripts/schema.sql` after the indexes, append:

   ```sql
   CREATE MATERIALIZED VIEW IF NOT EXISTS mv_value_score_components AS
   WITH category_price_bounds AS (
     SELECT category_id,
            MIN(price)::float AS min_price,
            MAX(price)::float AS max_price,
            AVG(price)::float AS avg_price,
            AVG(stars)::float AS avg_stars
     FROM Products
     WHERE price IS NOT NULL
     GROUP BY category_id
   ),
   recent_reviews AS (
     SELECT asin, COUNT(*)::int AS recent_review_count
     FROM Reviews
     WHERE review_timestamp >= NOW() - INTERVAL '12 months'
     GROUP BY asin
   )
   SELECT
     p.asin,
     p.category_id,
     p.brand_id,
     p.stars::float AS stars,
     p.review_count,
     p.price::float AS price,
     cpb.avg_price AS cat_avg_price,
     cpb.avg_stars AS cat_avg_stars,
     CASE WHEN cpb.max_price = cpb.min_price THEN 1.0
          ELSE 1.0 - (p.price::float - cpb.min_price)
                       / NULLIF(cpb.max_price - cpb.min_price, 0)
     END AS price_efficiency,
     COALESCE(rr.recent_review_count, 0) AS recent_review_count
   FROM Products p
   JOIN category_price_bounds cpb ON cpb.category_id = p.category_id
   LEFT JOIN recent_reviews rr ON rr.asin = p.asin
   WHERE p.price IS NOT NULL
     AND p.stars IS NOT NULL;

   CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_value_components_asin
     ON mv_value_score_components(asin);
   CREATE INDEX IF NOT EXISTS idx_mv_value_components_category
     ON mv_value_score_components(category_id);
   ```

   The unique index on `asin` is required so we can `REFRESH MATERIALIZED
   VIEW CONCURRENTLY` later.

2. Replace `valueRankingsQueryOptimized` body with a query that reads from
   the matview. Compute `dimension_bounds` (global min/max of stars,
   review_count, price_efficiency, recent_review_count) once via a CTE over
   the matview, then weighted-sum + ORDER BY + LIMIT 100. The query should
   join the matview to `categories` and `brands` only for the final 100 rows
   (move the join outside the windowed sort if necessary).

   Concretely:

   ```sql
   WITH bounds AS (
     SELECT MIN(stars) min_s, MAX(stars) max_s,
            MIN(review_count) min_r, MAX(review_count) max_r,
            MIN(price_efficiency) min_pe, MAX(price_efficiency) max_pe,
            MIN(recent_review_count) min_rr, MAX(recent_review_count) max_rr
     FROM mv_value_score_components
   ),
   scored AS (
     SELECT m.asin,
            m.category_id, m.brand_id,
            m.stars, m.review_count, m.price, m.recent_review_count,
            COALESCE((
              ($1 * (m.stars - b.min_s) / NULLIF(b.max_s - b.min_s, 0))
            + ($2 * (m.review_count - b.min_r) / NULLIF(b.max_r - b.min_r, 0))
            + ($3 * (m.price_efficiency - b.min_pe) / NULLIF(b.max_pe - b.min_pe, 0))
            + ($4 * (m.recent_review_count - b.min_rr) / NULLIF(b.max_rr - b.min_rr, 0))
            ) / NULLIF($1+$2+$3+$4, 0), 0)::float AS value_score
     FROM mv_value_score_components m CROSS JOIN bounds b
   )
   SELECT s.asin, p.title, s.price, s.stars, s.review_count,
          s.recent_review_count, p.img_url, c.category_name, b.brand_name,
          s.value_score
   FROM scored s
   JOIN Products p ON p.asin = s.asin
   JOIN Categories c ON c.category_id = s.category_id
   LEFT JOIN Brands b ON b.brand_id = s.brand_id
   ORDER BY s.value_score DESC NULLS LAST, s.stars DESC NULLS LAST,
            s.review_count DESC
   LIMIT 100;
   ```

   The trick: `scored` only carries narrow columns through the sort. Wide
   columns (title, img_url) are joined from `Products` only for the top 100.

3. Replace `topValueProductsQueryOptimized` to read from the matview as
   well:

   ```sql
   SELECT m.asin, p.title, m.price, m.stars, c.category_name
   FROM mv_value_score_components m
   JOIN Products p ON p.asin = m.asin
   JOIN Categories c ON c.category_id = m.category_id
   WHERE m.price < m.cat_avg_price
     AND m.stars > m.cat_avg_stars
     AND m.recent_review_count > 0
   ORDER BY m.stars DESC NULLS LAST, m.review_count DESC, m.price ASC NULLS LAST
   LIMIT 100;
   ```

   Note: this changes the semantics of `reviewedSince` — the matview uses a
   12-month window. Document this in the report and either drop the
   `reviewedSince` query parameter (preferred — simpler) or keep it as a
   hint and fall back to the original CTE shape when it differs from
   12 months. The user-visible page does not currently expose this slider.

4. Apply DDL on RDS. Run the matview build once (`CREATE MATERIALIZED VIEW`
   populates immediately).

5. `EXPLAIN ANALYZE` both queries. The value-rankings plan should be a Sort
   over a Hash Join over `Seq Scan on mv_value_score_components`, no
   reference to `Reviews`. Top-value plan should be `Index Scan on
   mv_value_score_components` filtered by the matview's stored cat_avg
   columns.

6. Run benchmark. Both should land well under 200 ms.

────────────────────────────────────────────────
## Step 4 — `mv_brand_performance` and `mv_category_compare`
────────────────────────────────────────────────

Goal: drop two seq-scan-everything analytics queries from ~3s to <10 ms.
Both are read-mostly, output is small, perfect matview candidates.

1. In `scripts/schema.sql`:

   ```sql
   CREATE MATERIALIZED VIEW IF NOT EXISTS mv_category_compare AS
   SELECT c.category_id,
          c.category_name,
          AVG(p.price)::float AS avg_price,
          AVG(p.stars)::float AS avg_rating,
          COUNT(p.asin)::int AS product_count
   FROM Categories c
   LEFT JOIN Products p ON p.category_id = c.category_id
   GROUP BY c.category_id, c.category_name;

   CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_category_compare_id
     ON mv_category_compare(category_id);

   CREATE MATERIALIZED VIEW IF NOT EXISTS mv_brand_performance AS
   WITH brand_product_stats AS (
     SELECT b.brand_id, b.brand_name,
            AVG(p.stars)::float AS avg_product_rating,
            COUNT(DISTINCT CASE WHEN p.is_best_seller THEN p.asin END)::int AS total_products
     FROM Brands b
     JOIN Products p ON p.brand_id = b.brand_id
     GROUP BY b.brand_id, b.brand_name
     HAVING AVG(p.stars) > 4.0
   ),
   brand_review_stats AS (
     SELECT p.brand_id,
            COUNT(*) AS qualifying_review_count,
            AVG(r.rating)::float AS avg_review_score,
            COALESCE(SUM(r.helpful_vote), 0)::int AS total_helpful_votes
     FROM Products p
     JOIN Reviews r ON r.asin = p.asin
     WHERE p.brand_id IS NOT NULL
       AND r.verified_purchase = TRUE
     GROUP BY p.brand_id
     HAVING COUNT(*) >= 10
   )
   SELECT bps.brand_id,
          bps.brand_name,
          bps.total_products,
          brs.avg_review_score,
          brs.total_helpful_votes
   FROM brand_product_stats bps
   JOIN brand_review_stats brs ON bps.brand_id = brs.brand_id;

   CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_brand_performance_id
     ON mv_brand_performance(brand_id);
   ```

2. Replace `categoriesCompareQueryOptimized`:

   ```sql
   SELECT category_name, avg_price, avg_rating, product_count
   FROM mv_category_compare
   ORDER BY category_name ASC;
   ```

3. Replace `brandsPerformanceQueryOptimized`:

   ```sql
   SELECT brand_name, total_products, avg_review_score, total_helpful_votes
   FROM mv_brand_performance
   ORDER BY avg_review_score DESC, total_helpful_votes DESC, brand_name ASC;
   ```

4. Apply DDL, populate matviews, EXPLAIN ANALYZE, benchmark. Both should
   come in under 20 ms even cold.

5. Keep the route-level cache in `server/cache.js` — it now becomes a
   second tier in front of the matview. Fine to leave the TTL as-is.

────────────────────────────────────────────────
## Step 5 — Refresh helper script
────────────────────────────────────────────────

Goal: a single command the report can reference for the matview maintenance
story.

1. Create `scripts/refresh_matviews.sql`:

   ```sql
   REFRESH MATERIALIZED VIEW CONCURRENTLY mv_value_score_components;
   REFRESH MATERIALIZED VIEW CONCURRENTLY mv_category_compare;
   REFRESH MATERIALIZED VIEW CONCURRENTLY mv_brand_performance;
   ```

2. Add a Node wrapper `scripts/refresh_matviews.js`:

   ```js
   const pool = require('../server/db');
   const fs = require('fs');
   const path = require('path');

   (async () => {
     const sql = fs.readFileSync(
       path.join(__dirname, 'refresh_matviews.sql'),
       'utf8'
     );
     const t0 = Date.now();
     await pool.query(sql);
     console.log(`refreshed in ${Date.now() - t0} ms`);
     await pool.end();
   })();
   ```

3. Document in `README.md` under a new "Maintenance" section:
   `node scripts/refresh_matviews.js` (run nightly or after re-ingest).

────────────────────────────────────────────────
## Step 6 — Bump benchmark iterations to 5+
────────────────────────────────────────────────

Goal: erase the negative speedups that are pure noise from the 2-run
benchmark. Defends the timings table against TA scrutiny.

1. Open `scripts/benchmark.js`. Find the loop that runs each query twice
   per mode. Bump to at least 5 iterations (10 is fine — most queries are
   sub-second after the steps above).

2. Report **median** as the headline (and keep min/max for the appendix).
   If the script currently only outputs `min / median`, change to
   `min / median / max` and use median for the speedup column.

3. Add a 1-second cold/warm separation: discard the first run's timing
   (cold cache), use the next 5 for the median. This matches the report's
   narrative that "warm cache" timings are what users actually see.

4. Re-run the benchmark in two phases:
   - `--phase pre-perf-baseline` — checkout to a temp branch that reverts
     all matview/index changes, run benchmark, save JSON. Or just reuse the
     existing `pre-index` baseline if it predates these changes.
   - `--phase post-perf` — current branch, all changes applied.
   Pass `--baseline pre-perf-baseline` to regenerate `docs/timings.md`.

5. Commit the new timings.md. Every complex query should now show ≥10x
   speedup; no row should be below 1.0x.

────────────────────────────────────────────────
## Step 7 — `Cache-Control` headers on stable endpoints
────────────────────────────────────────────────

Goal: free browser/CDN caching, makes the demo feel instant on repeat hits.

1. In `server/routes/meta.js`, on the `/categories` and `/brands` handlers,
   set:

   ```js
   res.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=60');
   ```

   before `res.json(rows)`.

2. In `server/routes/analytics.js`, on `/analytics/categories/compare`,
   `/analytics/brands/performance`, and `/analytics/reviews/trend`, set the
   same header. The reviews trend already varies by category — that's fine,
   the URL itself differentiates.

3. In `server/routes/products.js`, on `/products/:asin` (in
   `server/routes/meta.js`), `/products/:asin/rating-distribution`,
   `/products/:asin/helpful-reviews`, `/products/:asin/alternatives`, set:

   ```js
   res.set('Cache-Control', 'public, max-age=60');
   ```

4. Do NOT cache `/products/search`, `/cart/savings`, or `/products/value-rankings`
   — these vary by user input and should always hit the server.

5. Verify with `curl -I` that the header is present. Verify in the
   browser's network tab that a second hit on Analytics returns from disk
   cache.

────────────────────────────────────────────────
## Verification before sign-off
────────────────────────────────────────────────

- All 15 routes return 200 with both `?optimized=0` and `?optimized=1`.
- `pg_trgm` extension is created and `idx_products_title_trgm` exists.
- `idx_products_discount` partial index exists.
- All three materialized views exist and have unique indexes for
  CONCURRENT refresh.
- `node scripts/refresh_matviews.js` runs cleanly in <30s.
- `docs/timings.md` shows:
  - `/products/search`: <100 ms post, ≥20x speedup
  - `/deals`: <250 ms post, ≥10x speedup
  - `/products/top-value`: <100 ms post, ≥5x speedup
  - `/products/value-rankings`: <200 ms post, ≥25x speedup
  - `/analytics/categories/compare`: <20 ms post, ≥100x speedup
  - `/analytics/brands/performance`: <20 ms post, ≥100x speedup
  - No row below 1.0x speedup.
- `EXPLAIN ANALYZE` outputs for the four "complex" queries are saved under
  `docs/benchmarks/explain/` for the report's appendix.
- `Cache-Control` headers visible on the listed endpoints via `curl -I`.

## Things to deliberately NOT do

- Do not turn `/products/search` into a `to_tsvector` full-text route — it
  changes semantics (phrase search vs substring) and is a bigger refactor
  than trigram. Trigram is correct for the existing UI.
- Do not add `REFRESH MATERIALIZED VIEW` to a request handler. It locks
  the matview during the rebuild without `CONCURRENTLY` and even with
  CONCURRENTLY it is multi-second work. Refresh is a maintenance script.
- Do not drop the existing `idx_products_category` etc. — the unoptimized
  variants still rely on them, and removing them invalidates the timing
  comparison for the pre-optimization baseline.
- Do not change the API contract or the page-level UI.
