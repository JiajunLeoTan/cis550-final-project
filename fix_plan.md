# CIS 5500 Final-Delivery Fix Plan

You are picking up a CIS 5500 final project repo at /home/leo/dev/school/cis550-final-project.
Stack: Express + PG (AWS RDS) + React/Vite. Schema in scripts/schema.sql. 15 routes
under server/routes; queries under server/queries (each file exports both the original
and *Optimized variant). Frontend pages under client/src/pages. The query-mode toggle
adds ?optimized=1 — preserve that contract everywhere.

Deliverables are due May 8. Work in roughly the priority below; each block can ship
independently. Do NOT change the public API surface; do NOT delete the unoptimized
query variants (they are required for the timings comparison).

────────────────────────────────────────────────
P0 — Data & Schema (do these first; everything else depends on volume)
────────────────────────────────────────────────

1. Re-ingest reviews to ≥500k rows post-cleaning.
   - data/cleaned/reviews.csv currently has 11,665 rows. Rubric requires ≥100k per
     dataset; the analytics queries also need volume to hit "~15s pre-optimization."
   - Adjust scripts/clean_data.py sampling to keep more rows (target 500k–1M reviews
     after FK filter). Re-run scripts/ingest_data.py.
   - After ingesting, drop and rebuild the *_pkey on Reviews if needed.

2. Tighten brand entity resolution.
   - data/cleaned/brands.csv has 886k brands for 1.4M products. Update the brand
     extraction in scripts/clean_data.py to:
       a. lowercase + strip whitespace/punctuation when grouping
       b. drop brands with <5 products (singletons → NULL brand_id)
       c. canonicalize obvious variants (trailing "Inc", "Co.", "®", emojis)
   - Target: ≤50k distinct brands. Re-ingest. Update server/queries if any brand
     query relies on case-sensitive matches (it doesn't currently — verify).

3. Add the indexes you intentionally held back for the optimization story.
   - In scripts/schema.sql, after the "do not add" comment block, add:
       CREATE INDEX idx_reviews_asin_timestamp ON Reviews(asin, review_timestamp);
       CREATE INDEX idx_reviews_timestamp ON Reviews(review_timestamp);
       CREATE INDEX idx_products_category_price ON Products(category_id, price);
       CREATE INDEX idx_products_category_stars ON Products(category_id, stars);
       CREATE INDEX idx_reviews_verified ON Reviews(verified_purchase) WHERE verified_purchase = TRUE;
   - Apply with ALTER. Do NOT remove the smaller existing indexes.
   - These indexes are part of the OPTIMIZED path — pre-optimization timings should
     be measured before they are created (see step 5 plan).

────────────────────────────────────────────────
P0 — Missing artifacts (no points without these)
────────────────────────────────────────────────

4. Generate ER diagram.
   - Use dbdiagram.io or eraser.io syntax derived from scripts/schema.sql. Export PNG
     and SVG to docs/er_diagram.{png,svg}. The diagram must show all 5 tables,
     PK/FK arrows, cardinalities (1:N reviews→products, 1:N products→categories,
     1:N products→brands, 1:N reviews→users).

5. Build the performance evaluation table.
   - Write scripts/benchmark.js (Node, uses server/db.js) that:
       a. EXPLAIN ANALYZE each of the 4 complex queries + the 8 small queries
       b. Runs each twice in each mode (cold + warm) and reports min/median ms
       c. Uses representative inputs: category="Beauty & Personal Care" (or whichever
          has the most reviews after re-ingest), reviewedSince="2018-01-01",
          asin = pick one with >50 reviews
       d. Outputs a markdown table to docs/timings.md with columns:
          query | input | pre-opt ms | post-opt ms | speedup | EXPLAIN cost ratio
   - Run it in two passes: one before adding the new indexes from step 3, one after.
     The "before" numbers are your "pre-optimization." Save both.
   - For complex queries that don't hit ~15s even with 500k reviews, document them
     honestly — rubric says non-trivial-runtime is "~15s for at least 2 queries"
     and the user has confirmed that exact threshold isn't strictly enforced as long
     as there is significant improvement. Aim for ≥3x speedup on each complex query.

6. Final Report (6–10 pages).
   - Create docs/final_report.tex with sections matching Milestone 5a:
       1. Title  2. Introduction (group members included)  3. Architecture (with
       page-by-page summary; pull from client/README.md)  4. Data (datasets, sources,
       row counts post-cleaning, summary stats)  5. Database (ingestion, ER diagram
       embedded, 3NF proof per relation)  6. Queries (5 most complex, full SQL,
       what they do; remaining queries in appendix)  7. Performance evaluation
       (embed docs/timings.md table, then per-query: which optimization technique,
       why it worked, any failed experiments)  8. Technical challenges
       9. Extra credit (whatever ends up implemented)
   - Hard cap 10 pages excluding appendices.
   - For 3NF proof: enumerate functional dependencies per table, show every
     non-trivial FD has a superkey on the LHS. Five tables, one paragraph each.

7. Demo video (2–4 minutes).
   - Script in docs/demo_script.md first, then record. Cover: hero/search → product
     detail with rating distribution + alternatives → cart savings → analytics
     (all 3 charts) → value rankings with sliders. Narrate which query backs each
     view and the headline before/after timing. Upload to Penn Google Drive.

8. Presentation slides for live demo.
   - 8–10 slides: problem, datasets, ER diagram, schema/3NF, the 4 complex queries
     (one per slide with the SQL and timing numbers), tech challenges, extra credit.
     Save to docs/slides.pdf. Make sure it uses data and graph. No overflowing of any element.

────────────────────────────────────────────────
P1 — Code-level fixes
────────────────────────────────────────────────

9. Add caching to the analytics endpoints.
   - In server/routes/analytics.js, lift the cache helper from server/routes/meta.js
     (extract to server/cache.js — both files use it).
   - Cache /analytics/categories/compare and /analytics/brands/performance under the
     optimized flag with a 5-minute TTL. /analytics/reviews/trend should be cached
     keyed by category, also 5 min.

10. Tighten input validation.
    - server/routes/cart.js: reject asins arrays longer than 200, and asins not
      matching /^[A-Z0-9]{10}$/ (Amazon ASIN format).
    - server/routes/products.js: same ASIN regex on every :asin path param.
    - Reject keyword longer than 200 chars on /products/search.
    - /products/value-rankings: 400 if all four weights are 0.

11. Add a top-level README.md at repo root.
    - Project description, dataset sources + sizes, architecture diagram (link to
      docs/), how to run server + client locally, how to ingest data, link to
      deployed URL once done. Required for the code-zip submission.

12. Add .env.example at repo root.
    - Mirror server/README.md's template. No real credentials. server/README.md
      already references `cp .env.example .env`.

────────────────────────────────────────────────
P2 — Extra credit (4 pts max, 2 pts each)
────────────────────────────────────────────────

13. Deploy.
    - Backend: Render or Fly.io (env vars from .env, expose 8080).
    - Frontend: Vercel; set VITE_API_BASE_URL to the deployed backend URL.
    - Add the live URL to README.md and the report. This is the easiest 2 pts.

14. One more EC item if time permits — pick ONE:
    - Backend test coverage >80% with vitest/jest on server/queries (pure SQL string
      checks + integration tests against a small Postgres).
    - OR password-hashing + simple session login on top of the existing guest user
      pattern in scripts/create_guest_user.py (security EC).
    - OR a Redis cache replacing the in-memory Map (NoSQL EC).

────────────────────────────────────────────────
Verification before sign-off
────────────────────────────────────────────────

- All 15 routes return 200 with both ?optimized=0 and ?optimized=1.
- docs/timings.md shows ≥3x speedup on each of the 4 complex queries.
- Reviews table has ≥100k rows; brands table has ≤50k.
- Final report PDF is 6–10 pages and has every Milestone 5a section.
- ER diagram PNG renders cleanly.
- Demo video is 2–4 minutes and uploaded.
- README.md and .env.example exist at repo root.
- Live demo URL works (if deploying).

Do NOT touch: the API contract, the unoptimized query variants, the page-level
layouts (the UI is graded as-is and rework risks regressions).

You are allowed to execute the plan in phases.