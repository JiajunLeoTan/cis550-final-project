# CIS 5500 Express Backend

Express.js backend for the Data-Driven Shopping Assistant Milestone 4 API.

## Setup

Run these commands from the project root:

```bash
npm install
cp .env.example .env
npm run dev
```

The server reads database credentials from the root `.env` file and starts on `PORT=8080` by default.

## `.env` Template

```env
DB_HOST=your-rds-endpoint.amazonaws.com
DB_PORT=5432
DB_NAME=shopping_assistant
DB_USER=postgres
DB_PASSWORD=your-strong-password
GUEST_USER=guest
GUEST_PASSWORD=your-guest-password
PORT=8080
```

## Notes

- Routes are mounted at the root. There is no `/api/v1` prefix.
- AWS RDS connections use `ssl: { rejectUnauthorized: false }`.
- Product SQL is split by feature under `server/queries/products/`, with
  original and optimized variants exported through the barrel module.
- `recent_review_count` is computed from `reviews.review_timestamp`; it is not stored on `products`.

## Routes

### 1. `GET /categories`

```bash
curl "http://127.0.0.1:8080/categories"
```

### 2. `GET /brands`

```bash
curl "http://127.0.0.1:8080/brands"
```

### 3. `GET /products/:asin`

```bash
curl "http://127.0.0.1:8080/products/B014TMV5YE"
```

### 4. `GET /products/search`

```bash
curl "http://127.0.0.1:8080/products/search?keyword=guacamole&minStars=4"
```

### 5. `GET /deals`

```bash
curl "http://127.0.0.1:8080/deals?maxPrice=250"
```

### 6. `GET /products/:asin/rating-distribution`

```bash
curl "http://127.0.0.1:8080/products/B0719KWG8H/rating-distribution"
```

### 7. `GET /products/:asin/helpful-reviews`

```bash
curl "http://127.0.0.1:8080/products/B0719KWG8H/helpful-reviews"
```

### 8. `GET /products/:asin/alternatives`

```bash
curl "http://127.0.0.1:8080/products/B0092MCQZ4/alternatives"
```

### 9. `POST /cart/savings`

```bash
curl -X POST "http://127.0.0.1:8080/cart/savings" \
  -H "Content-Type: application/json" \
  -d '{"asins":["B07SJHLTBT","B083Y6BJ8W"]}'
```

### 10. `GET /analytics/categories/compare`

```bash
curl "http://127.0.0.1:8080/analytics/categories/compare"
```

### 11. `GET /products/trending`

```bash
curl "http://127.0.0.1:8080/products/trending?category=Hair%20Care%20Products&months=120"
```

### 12. `GET /products/top-value`

```bash
curl "http://127.0.0.1:8080/products/top-value?reviewedSince=2018-01-01"
```

### 13. `GET /analytics/brands/performance`

```bash
curl "http://127.0.0.1:8080/analytics/brands/performance"
```

### 14. `GET /analytics/reviews/trend`

```bash
curl "http://127.0.0.1:8080/analytics/reviews/trend?category=Hair%20Care%20Products"
```

### 15. `GET /products/value-rankings`

```bash
curl "http://127.0.0.1:8080/products/value-rankings?wRating=0.4&wReviews=0.2&wPriceEff=0.2&wRecent=0.2"
```
