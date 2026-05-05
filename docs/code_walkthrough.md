# Code Walkthrough

This walkthrough explains how the project code fits together and what each main
piece reads, writes, returns, or protects. The short version is:

```text
data/raw/*.csv
  -> data_pipeline/clean_data.py
  -> data/cleaned/*.csv
  -> data_pipeline/ingest_data.py + database/schema.sql
  -> PostgreSQL on AWS RDS
  -> server/ Express routes and SQL modules
  -> client/src/ React pages and components
```

The code is split into a Python data pipeline, PostgreSQL schema/query assets,
an Express API, a React frontend, and test/operations scripts.

## Data Flow

Raw product, category, and review CSVs start in `data/raw/`. The cleaner
normalizes those files into the relational CSVs in `data/cleaned/`:
`categories.csv`, `brands.csv`, `products.csv`, `users.csv`, and `reviews.csv`.
The ingestion script applies the schema and copies those cleaned files into
PostgreSQL in foreign-key order. The server reads PostgreSQL through `pg`, keeps
the public API routes stable, and switches between original and optimized SQL
when the query string includes `?optimized=1`. The client calls those routes,
stores a small cart locally, and renders search, product detail, cart, analytics,
and ranking views.

## Data Pipeline

### `data_pipeline/clean_data.py`

This script is the main ETL step. It takes raw CSV files from `data/raw/` and
writes cleaned CSVs to `data/cleaned/` in the shape expected by
`database/schema.sql`.

Inputs:
- `data/raw/amazon_products.csv`: product catalog rows.
- `data/raw/amazon_categories.csv`: category lookup rows.
- Non-`amazon_*.csv` review streams when present, otherwise
  `data/raw/amazon_reviews.csv` or `data/raw/Amazon_reviews_2023.csv`.

Outputs:
- `categories.csv`: category ID and category name.
- `brands.csv`: generated brand IDs and readable brand names.
- `products.csv`: one product per ASIN, with category and optional brand IDs.
- `reviews.csv`: review facts linked to known product ASINs.
- `users.csv`: distinct reviewer IDs from the linked review rows.
- `outliers.csv`: only written when suspicious product prices are found.

Important function groups:

- Path and mapping constants translate raw file headers into the names used by
  the relational schema. This keeps the rest of the cleaner independent from
  small raw-dataset naming changes.
- `first_existing_path()` chooses between legacy review filenames without
  forcing the caller to edit code.
- `parse_price()` turns Amazon-style prices such as `$1,299.99` into floats and
  leaves bad values as `NaN` so pandas can handle them cleanly.
- `parse_review_timestamps()` accepts both text timestamps and McAuley
  millisecond epoch values.
- `extract_brand()`, `normalize_brand()`, and `canonical_brand_name()` derive a
  brand dimension from product titles. The product dataset has no official brand
  table, so brands are guessed conservatively and brands with fewer than five
  products are not linked.
- `discover_review_files()` prefers the newer category review streams and falls
  back to the legacy review CSV.
- `validate_product_dimensions()` checks the product, category, brand, and valid
  ASIN outputs before the files are trusted for ingestion.
- `clean_categories()` trims names, removes missing/duplicate category IDs, and
  writes `categories.csv`.
- `clean_products()` deduplicates products by ASIN, parses prices and ratings,
  maps categories, extracts brands, keeps the full product catalog for the
  million-row requirement, writes `products.csv` and `brands.csv`, and returns
  the product ASIN set used to link reviews.
- `clean_review_chunk()` cleans one review chunk at a time so the script can
  handle large streams without loading every review row into memory. It fills
  optional columns, normalizes ASIN fields, falls back from `asin` to
  `parent_asin` when needed, filters orphan reviews, parses ratings and
  timestamps, and returns per-chunk cleanup counters.
- `dedupe_against_seen()` removes duplicates across chunks and source files by
  tracking `(asin, user_id, review_timestamp)`.
- `clean_reviews()` streams review chunks, assigns sequential `review_id` values,
  writes `reviews.csv` incrementally, writes `users.csv`, and fails if the final
  linked review count is below the configured threshold.
- `parse_args()` supports `--products-only` for rebuilding product dimensions
  before reviews are available.
- `main()` checks inputs, runs categories -> products/brands -> reviews, and
  prints a size summary for the cleaned outputs.

### `data_pipeline/ingest_data.py`

This script loads the cleaned CSVs into PostgreSQL.

Inputs:
- `.env` database credentials.
- `database/schema.sql`.
- All cleaned CSVs in `data/cleaned/`.

Outputs and side effects:
- Recreates the PostgreSQL schema.
- Loads each table with `COPY`.
- Runs relationship checks for orphan products or reviews.
- Creates or refreshes the read-only guest database user.

Important pieces:
- `DB_CONFIG`, `CLEAN_DIR`, and `SCHEMA_FILE` define the connection target and
  input files.
- `TABLES` lists the CSVs in dependency order: categories and brands before
  products, users before reviews.
- `get_connection()` opens the `psycopg2` connection from `.env`.
- `run_schema()` executes the full schema file.
- `load_table()` skips CSV headers and uses PostgreSQL `COPY` for bulk loading.
  It returns the table row count reported by PostgreSQL.
- `validate()` checks the foreign-key relationships that would most likely
  reveal a bad clean/load cycle.
- `validate_input_files()` supports `--dry-run` by checking that all required
  files exist before connecting to the database.
- `create_guest_user()` grants a configured guest account read-only access.
- `main()` ties the steps together and rolls back on failure.

### `data_pipeline/create_guest_user.py`

This is a smaller operational helper for re-applying guest credentials and
grants without reloading the database.

Inputs:
- `.env` database credentials.
- `.env` `GUEST_USER` and `GUEST_PASSWORD`.

Side effects:
- Creates the guest role if needed.
- Updates its password if it already exists.
- Grants database connect, schema usage, current table select, and future table
  select privileges.

## Database

### `database/schema.sql`

This is the fresh bootstrap schema used by ingestion. It drops and recreates the
normalized tables:

- `Categories(category_id, category_name)`.
- `Brands(brand_id, brand_name)`.
- `Products(asin, title, URLs, prices, stars, counts, category_id, brand_id)`.
- `Users(user_id)`.
- `Reviews(review_id, asin, user_id, rating, text, helpful votes, timestamp)`.

It also creates basic indexes for foreign keys and common filters, then adds
optimized-path indexes and materialized views:

- `idx_products_title_trgm` for substring title search.
- Discount/category/brand/review indexes used by product and analytics routes.
- `mv_value_score_components` for value ranking, top-value, and trending.
- `mv_category_compare` for category analytics.
- `mv_brand_performance` for brand analytics.

### `database/perf_ddl.sql`

This file rebuilds the same performance indexes and materialized views on an
already-loaded database. It is useful when the data has already been ingested
and the team wants to apply or refresh the optimized structures without
dropping the base tables.

### `database/refresh_matviews.sql`

This file runs `REFRESH MATERIALIZED VIEW CONCURRENTLY` for the three
materialized views. It depends on each view having a unique index, which the
schema/performance DDL creates.

## Server

The backend is an Express app. Route modules validate inputs, choose original or
optimized SQL based on `?optimized=1` or `?optimized=true`, run parameterized
queries through the shared pool, and return JSON.

### Server infrastructure

| File | What it does | Inputs | Returns / side effects |
|---|---|---|---|
| `server/index.js` | Builds the Express app, mounts route modules, and starts the server when run directly. | HTTP requests, `.env` through config. | Exports the app for tests; listens on `PORT` in normal runs. |
| `server/config.js` | Loads `.env`, validates required database variables, and parses numeric config. | `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, optional `PORT` and `CLIENT_ORIGIN`. | Config object for server and database. |
| `server/db.js` | Creates the shared PostgreSQL pool. | Config from `server/config.js`. | Exports a `pg.Pool`; logs idle client errors. |
| `server/cache.js` | Small in-memory TTL cache used for stable metadata/analytics responses. | Cache key, TTL, loader function. | Returns cached or freshly loaded data; exposes `clearCache()` for tests. |

### Route modules

| File | Routes | Data handling |
|---|---|---|
| `server/routes/meta.js` | `GET /categories`, `GET /brands`, `GET /products/:asin`. | Validates ASIN format, uses short cache headers, caches optimized category/brand reads in memory, returns 404 for missing products. |
| `server/routes/products.js` | Search, deals, category listing, brand listing, rating distribution, helpful reviews, alternatives, trending, top-value, value rankings. | Parses numeric query params with bounds, rejects bad ASINs/weights, checks product existence before detail subqueries, and keeps response shapes stable across original/optimized SQL. |
| `server/routes/cart.js` | `POST /cart/savings`. | Validates an array of up to 200 ASINs and returns aggregate list price, current price, and savings. |
| `server/routes/analytics.js` | Category comparison, brand performance, review trend. | Uses optimized materialized views when available; caches optimized category comparison and review trend responses; requires category for review trends. |

### SQL modules

| File | What it contains | Notes on inputs and outputs |
|---|---|---|
| `server/queries/meta.sql.js` | Category/brand list queries and product detail query. | Product detail takes ASIN and returns one product row with display category/brand names. |
| `server/queries/cart.sql.js` | Original and optimized cart savings SQL. | Takes an ASIN array and returns one aggregate row. |
| `server/queries/analytics.sql.js` | Category comparison, brand performance, and review trend SQL. | Optimized category/brand queries read materialized views; review trend keeps the same grouped SQL and relies on caching. |
| `server/queries/products/index.js` | Barrel export for product SQL modules. | Lets routes and benchmark scripts import product queries from one place. |
| `server/queries/products/search.sql.js` | Product existence and title search. | Search takes keyword, min stars, limit, and offset. |
| `server/queries/products/deals.sql.js` | Discounted product listing. | Takes max price, min stars, limit, and offset. |
| `server/queries/products/browse.sql.js` | Category and brand product listings. | Takes category/brand name plus filters and pagination; optimized queries page product rows before joining display names. |
| `server/queries/products/detail.sql.js` | Rating distribution, helpful reviews, alternatives. | Takes ASIN and returns chart rows, review rows, or product alternatives. |
| `server/queries/products/trending.sql.js` | Category trending products. | Original query counts recent reviews live; optimized query reads recent counts from the value components view. |
| `server/queries/products/value.sql.js` | Top-value and weighted ranking queries. | Original queries compute scoring live; optimized queries use precomputed normalized components, with the `0.4/0.2/0.2/0.2` default score indexed for the Balanced preset. |

## Client

The frontend is a React/Vite single-page app. The API layer turns UI state into
route calls, `useApi` handles cancelable fetches, pages own their filters, and
components render repeated UI pieces.

### App shell and shared state

| File | What it does | Inputs | Returns / side effects |
|---|---|---|---|
| `client/src/main.jsx` | Creates the React root. | `#root` from `index.html`. | Wraps the app with `BrowserRouter` and `CartProvider`. |
| `client/src/App.jsx` | Defines the route map and layout shell. | Browser path. | Renders header, current page, and footer. |
| `client/src/api/client.js` | Central fetch wrapper and endpoint map. | API base URL, query mode from `localStorage`, endpoint params. | Returns parsed JSON or throws an Error with status; appends `optimized=1` in optimized mode. |
| `client/src/api/useApi.js` | Generic cancelable data-fetching hook. | Fetch function, dependency list, optional skip/initial state. | Returns `{ data, loading, error, setData }`; aborts stale requests. |
| `client/src/context/CartContext.jsx` | Cart state and actions. | Product objects from pages/cards. | Persists cart items to `localStorage`, exposes add/remove/toggle/has/clear/count. |
| `client/src/utils/format.js` | Display formatting helpers. | Numbers, dates, text. | Currency, stars, counts, percents, dates, months, and truncated text. |
| `client/src/styles/index.css` | Design tokens and all app styles. | CSS custom properties and class names from components/pages. | Defines layout, forms, cards, product grids, charts, states, responsiveness, and reduced-motion behavior. |

### Pages

| File | What it does | Data it reads/writes |
|---|---|---|
| `client/src/pages/Home.jsx` | Landing/workspace page with search, featured trending products, and deals. | Reads trending and deals endpoints; writes navigation state when search submits. |
| `client/src/pages/Browse.jsx` | Browse/search page with URL-backed filters and infinite loading. | Reads categories, category previews, and product search; writes `q`, `minStars`, and `maxPrice` to the URL. |
| `client/src/pages/Deals.jsx` | Deal listing with price/rating filters. | Reads `/deals`; filter state is local and debounced. |
| `client/src/pages/CategoryPage.jsx` | Paginated products for one category. | Reads category metadata and category products; keeps filters in the URL and loads more with an intersection observer. |
| `client/src/pages/BrandPage.jsx` | Paginated products for one brand. | Reads brand products; keeps filters in the URL and loads more with an intersection observer. |
| `client/src/pages/ProductDetail.jsx` | Product overview, rating chart, helpful reviews, alternatives, and cart action. | Reads product detail plus three product-side endpoints; writes cart changes through `CartContext`. |
| `client/src/pages/Cart.jsx` | Cart receipt and savings summary. | Reads cart items from context, posts ASINs to `/cart/savings`, can remove or clear items. |
| `client/src/pages/Analytics.jsx` | Category bars, brand leaderboard, and review trend chart. | Reads categories, category comparison, brand performance, and review trend data; local state controls metric/category. |
| `client/src/pages/ValueRankings.jsx` | Weighted product ranking tool. | Reads `/products/value-rankings`; the Balanced preset uses `0.4/0.2/0.2/0.2`, and local sliders choose custom weights. |
| `client/src/pages/NotFound.jsx` | Simple 404 page. | No API data; links back home. |

### Components

| File | What it does | Data handling |
|---|---|---|
| `client/src/components/Header.jsx` | Site navigation and cart count. | Reads cart count from context and uses `NavLink` active state. |
| `client/src/components/Footer.jsx` | Footer colophon and SQL mode toggle. | Renders `QueryModeToggle`. |
| `client/src/components/QueryModeToggle.jsx` | Switches between standard and optimized query mode. | Reads/writes `localStorage` through API helpers and reloads so all hooks refetch under the selected mode. |
| `client/src/components/ProductCard.jsx` | Reusable product tile. | Takes product rows from many endpoints, formats price/rating, links to product detail, and shows badges/placeholder text when image data is missing. |
| `client/src/components/Rating.jsx` | Star rating display. | Handles missing or zero-count ratings with a muted state. |
| `client/src/components/StarIcon.jsx` | Inline SVG star. | Receives size/fill/class props; hides itself from screen readers. |
| `client/src/components/States.jsx` | Loading, empty, and error UI helpers. | Components receive counts, messages, errors, and optional retry/action callbacks. |
| `client/src/components/charts/BarChart.jsx` | Vertical SVG bars. | Receives label/value rows and optional formatting. |
| `client/src/components/charts/HorizontalBars.jsx` | Horizontal SVG bars for comparisons. | Supports label truncation, links, and click selection. |
| `client/src/components/charts/LineChart.jsx` | Multi-series SVG line chart with optional volume bars and tooltip. | Receives series, x labels/values, optional y-domain, and volume data; computes ticks and hover tooltip state locally. |

## Scripts

| File | What it does | Inputs | Outputs / side effects |
|---|---|---|---|
| `scripts/run_sql.js` | Applies a SQL file through the shared DB pool. | Path argument, `.env` DB config. | Executes the file and prints elapsed time. |
| `scripts/refresh_matviews.js` | Runs the materialized-view refresh SQL. | `.env` DB config, `database/refresh_matviews.sql`. | Refreshes views and prints elapsed time. |
| `scripts/benchmark.js` | Benchmarks original and optimized SQL with `EXPLAIN ANALYZE`. | Loaded database, optional `--phase` and `--baseline`. | Writes benchmark JSON, EXPLAIN plans, and `docs/timings.md`. |

## Tests And Config

Server tests mock the database pool and assert route behavior, validation,
caching, and query selection without needing a live database.

| File | What it protects |
|---|---|
| `server/tests/setup.js` | Test environment setup for server tests. |
| `server/tests/config.test.js` | Required `.env` validation and integer parsing behavior. |
| `server/tests/cache.test.js` | TTL cache hits, misses, and clearing. |
| `server/tests/routes/meta.test.js` | Metadata/product routes, optimized cache behavior, ASIN validation, 404 handling. |
| `server/tests/routes/products.test.js` | Product route validation, parameter parsing, optimized/original query selection, product subroutes. |
| `server/tests/routes/cart.test.js` | Cart ASIN validation and savings query behavior. |
| `server/tests/routes/analytics.test.js` | Analytics routes, category requirement, caching, and optimized/original branches. |

Client tests mock fetches and router context to protect page rendering, API
wrapping, cart behavior, charts, and formatting helpers.

| File | What it protects |
|---|---|
| `client/tests/setup.js` | JSDOM/testing-library setup. |
| `client/tests/test-utils.jsx` | Shared render helpers for providers/router. |
| `client/tests/api-mock.js` | Shared mock API/fetch utilities. |
| `client/tests/api/client.test.js` | API path building, errors, query mode, and endpoint wrappers. |
| `client/tests/api/useApi.test.js` | Loading/error/data states and abort behavior in `useApi`. |
| `client/tests/context/CartContext.test.jsx` | Cart add/remove/toggle/clear and persistence behavior. |
| `client/tests/App.test.jsx` | App routing shell. |
| `client/tests/pages/Home.test.jsx` | Home search and featured product/deal states. |
| `client/tests/pages/Browse.test.jsx` | Browse filters, search/category states, and loading/empty paths. |
| `client/tests/pages/Deals.test.jsx` | Deal filters and rendered products. |
| `client/tests/pages/CategoryPage.test.jsx` | Category product loading, filters, and empty/error states. |
| `client/tests/pages/BrandPage.test.jsx` | Brand product loading, filters, and empty/error states. |
| `client/tests/pages/ProductDetail.test.jsx` | Product detail, charts, reviews, alternatives, and cart actions. |
| `client/tests/pages/Cart.test.jsx` | Cart receipt and savings request behavior. |
| `client/tests/pages/Analytics.test.jsx` | Analytics charts, category selector, and empty/error paths. |
| `client/tests/pages/ValueRankings.test.jsx` | Weight presets/sliders and ranking output. |
| `client/tests/pages/NotFound.test.jsx` | 404 page rendering. |
| `client/tests/components/Header.test.jsx` | Navigation and cart count. |
| `client/tests/components/Footer.test.jsx` | Footer and query toggle placement. |
| `client/tests/components/QueryModeToggle.test.jsx` | Query mode localStorage writes and reload behavior. |
| `client/tests/components/ProductCard.test.jsx` | Product card labels, links, images, price/rating display. |
| `client/tests/components/Rating.test.jsx` | Rating output and no-rating state. |
| `client/tests/components/StarIcon.test.jsx` | SVG rendering props. |
| `client/tests/components/States.test.jsx` | Skeleton, empty, and error components. |
| `client/tests/components/charts/BarChart.test.jsx` | Vertical chart rendering and value labels. |
| `client/tests/components/charts/HorizontalBars.test.jsx` | Horizontal chart bars, links, and selection. |
| `client/tests/components/charts/LineChart.test.jsx` | Line paths, legends, volume bars, and tooltip behavior. |
| `client/tests/utils/format.test.js` | Currency, star, count, percent, date, and truncation helpers. |

Project-level config and support files:

| File | What it is for |
|---|---|
| `package.json` | Backend/server scripts and dependencies. |
| `client/package.json` | Frontend scripts and dependencies. |
| `vitest.config.js` | Root/server Vitest config. |
| `client/vitest.config.js` | Client Vitest config. |
| `client/vite.config.js` | Vite dev/build config. |
| `requirements.txt` | Python cleaning/ingestion dependencies. |
| `setup.sh` | Local setup helper. |
| `tests/README.md` | Notes for the test suite. |

## Coverage Checklist

The walkthrough covers these source paths directly:

- `data_pipeline/clean_data.py`
- `data_pipeline/ingest_data.py`
- `data_pipeline/create_guest_user.py`
- `database/schema.sql`
- `database/perf_ddl.sql`
- `database/refresh_matviews.sql`
- `server/index.js`
- `server/config.js`
- `server/db.js`
- `server/cache.js`
- `server/routes/meta.js`
- `server/routes/products.js`
- `server/routes/cart.js`
- `server/routes/analytics.js`
- `server/queries/meta.sql.js`
- `server/queries/cart.sql.js`
- `server/queries/analytics.sql.js`
- `server/queries/products/index.js`
- `server/queries/products/search.sql.js`
- `server/queries/products/deals.sql.js`
- `server/queries/products/browse.sql.js`
- `server/queries/products/detail.sql.js`
- `server/queries/products/trending.sql.js`
- `server/queries/products/value.sql.js`
- `server/tests/setup.js`
- `server/tests/config.test.js`
- `server/tests/cache.test.js`
- `server/tests/routes/meta.test.js`
- `server/tests/routes/products.test.js`
- `server/tests/routes/cart.test.js`
- `server/tests/routes/analytics.test.js`
- `client/src/main.jsx`
- `client/src/App.jsx`
- `client/src/api/client.js`
- `client/src/api/useApi.js`
- `client/src/context/CartContext.jsx`
- `client/src/utils/format.js`
- `client/src/styles/index.css`
- `client/src/pages/Home.jsx`
- `client/src/pages/Browse.jsx`
- `client/src/pages/Deals.jsx`
- `client/src/pages/CategoryPage.jsx`
- `client/src/pages/BrandPage.jsx`
- `client/src/pages/ProductDetail.jsx`
- `client/src/pages/Cart.jsx`
- `client/src/pages/Analytics.jsx`
- `client/src/pages/ValueRankings.jsx`
- `client/src/pages/NotFound.jsx`
- `client/src/components/Header.jsx`
- `client/src/components/Footer.jsx`
- `client/src/components/QueryModeToggle.jsx`
- `client/src/components/ProductCard.jsx`
- `client/src/components/Rating.jsx`
- `client/src/components/StarIcon.jsx`
- `client/src/components/States.jsx`
- `client/src/components/charts/BarChart.jsx`
- `client/src/components/charts/HorizontalBars.jsx`
- `client/src/components/charts/LineChart.jsx`
- `scripts/run_sql.js`
- `scripts/refresh_matviews.js`
- `scripts/benchmark.js`
