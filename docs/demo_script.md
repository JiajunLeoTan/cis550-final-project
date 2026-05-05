# Demo Video Script

For code-level explanations behind the demo, use `docs/code_walkthrough.md`.

Target length: 2 to 4 minutes.

## 0:00-0:20 Home and Search

Open the deployed frontend. Show the home page, type a product keyword, and
submit search. Mention that search uses `GET /products/search` and that the
query-mode toggle appends `?optimized=1` for the optimized backend path.

## 0:20-0:55 Product Detail

Open a product detail page. Show the product metadata, rating distribution, most
helpful reviews, and alternatives. Mention these routes:

- `GET /products/:asin`
- `GET /products/:asin/rating-distribution`
- `GET /products/:asin/helpful-reviews`
- `GET /products/:asin/alternatives`

Timing headline: rating distribution improved from 1.4 ms median to 1.1 ms
median, and helpful reviews improved from 21.7 ms median to 1.1 ms median.

## 0:55-1:20 Cart Savings

Add two products to the cart and open the cart page. Show total list price,
current price, and savings. Mention `POST /cart/savings` and the ASIN array
validation added for final delivery.

## 1:20-2:15 Analytics

Open Analytics. Show all three charts:

- Category comparison: `GET /analytics/categories/compare`
- Brand performance: `GET /analytics/brands/performance`
- Review trend: `GET /analytics/reviews/trend`

Mention that optimized analytics responses are cached for five minutes and that
the review trend cache is keyed by category. Category comparison now reads from
a materialized view and improved from 1805.5 ms median to 0.4 ms median.

## 2:15-3:00 Value Rankings

Open Value Rankings and move each slider. Explain that
`GET /products/value-rankings` computes a weighted score across rating, review
volume, price efficiency, and recent review activity. Use the before/after
timing headline from `docs/timings.md`.
Timing headline: value rankings improved from 9223.5 ms median to 1.7 ms
median.

## 3:00-3:30 Closing

Show the ER diagram or slides briefly. Close by stating the final row counts,
the strongest speedup, and the live deployment URL.
