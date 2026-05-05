# Axiom Final Demo Slides

## 1. Problem

Shopping data is large, noisy, and difficult to compare manually. Axiom turns
product metadata and reviews into searchable product discovery, cart savings,
and analytics views.

## 2. Datasets

- Products: `amazon_products.csv`
- Reviews: final matching review source; checked-in `amazon_reviews.csv` is a smaller subset
- Categories: `amazon_categories.csv`
- Cleaned relational outputs: Categories, Brands, Products, Users, Reviews

## 3. ER Diagram

Use `docs/er_diagram.png`.

## 4. Schema and 3NF

Every relation has a primary-key determinant for its non-key attributes.
Foreign-key facts stay in lookup tables, avoiding transitive dependencies.

## 5. Complex Query: Brand Performance

Aggregates product and verified-review metrics per brand. Optimized variant
reads the materialized brand performance view and uses its sort index.

Timing: 457.2 ms median to 0.1 ms median (9143.14x).

## 6. Complex Query: Review Trend

Groups monthly category reviews and compares high-credibility and
low-credibility reviewers. Optimized route keeps the grouped SQL and caches
repeat category requests.

Timing: 11.9 ms median to 11.8 ms median (1.00x), with route caching for repeat hits.

## 7. Complex Query: Top Value and Trending

Compares products against category averages and recent review windows.
Optimized variants read value components from the materialized view and use
indexes for top-value and trending orderings.

Top-value timing: 449.7 ms median to 0.9 ms median (527.20x).
Trending timing: 30.3 ms median to 7.5 ms median (4.06x).

## 8. Complex Query: Value Rankings

Ranks products using weighted normalized dimensions: rating, review count, price
efficiency, and recent review count.

Balanced preset weights: 0.4 / 0.2 / 0.2 / 0.2.

Timing: 9363.9 ms median to 1.4 ms median (6741.49x).

## 9. Technical Challenges

- Brand entity resolution from noisy titles
- Review/product ASIN mismatch across raw sources
- Preserving original SQL variants for timing comparison
- Caching selected optimized analytics responses without changing the API

## 10. Extra Credit and Demo

Deployment is the recommended extra-credit path. Add the final frontend URL and
backend URL after hosting.
