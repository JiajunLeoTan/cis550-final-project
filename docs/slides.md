# Axiom Final Demo Slides

## 1. Problem

Shopping data is large, noisy, and difficult to compare manually. Axiom turns
product metadata and reviews into searchable product discovery, cart savings,
and analytics views.

## 2. Datasets

- Products: `amazon_products.csv`
- Reviews: `amazon_reviews.csv`
- Categories: `amazon_categories.csv`
- Cleaned relational outputs: Categories, Brands, Products, Users, Reviews

## 3. ER Diagram

Use `docs/er_diagram.png`.

## 4. Schema and 3NF

Every relation has a primary-key determinant for its non-key attributes.
Foreign-key facts stay in lookup tables, avoiding transitive dependencies.

## 5. Complex Query: Brand Performance

Aggregates product and verified-review metrics per brand. Optimized variant
pushes filters into CTE `HAVING` clauses and uses final indexes.

Timing: 2849.7 ms median to 0.0 ms median (58156.90x).

## 6. Complex Query: Review Trend

Groups monthly category reviews and compares high-credibility and
low-credibility reviewers. Optimized variant filters to the category first.

Timing: 34.8 ms median to 34.6 ms median (1.01x), with route caching for repeat hits.

## 7. Complex Query: Top Value and Trending

Compares products against category averages and recent review windows.
Optimized variants rely on final indexes and preserve the planner's fastest
shape when a CTE rewrite is slower.

Top-value timing: 444.4 ms median to 0.8 ms median (530.94x).
Trending timing: 22.6 ms median to 4.2 ms median (5.37x).

## 8. Complex Query: Value Rankings

Ranks products using weighted normalized dimensions: rating, review count, price
efficiency, and recent review count.

Timing: 9223.5 ms median to 1.7 ms median (5586.64x).

## 9. Technical Challenges

- Brand entity resolution from noisy titles
- Review/product ASIN mismatch across raw sources
- Preserving original SQL variants for timing comparison
- Caching only optimized analytics routes without changing the API

## 10. Extra Credit and Demo

Deployment is the recommended extra-credit path. Add the final frontend URL and
backend URL after hosting.
