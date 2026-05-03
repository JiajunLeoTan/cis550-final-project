import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import pool from '../../server/db.js';
import app from '../../server/index.js';

const VALID_ASIN = 'B0719KWG8H';

beforeEach(() => {
  pool.query = vi.fn().mockResolvedValue({ rows: [], rowCount: 0 });
});

describe('GET /products/search', () => {
  it('returns rows with default filters', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [{ asin: VALID_ASIN, title: 'Cleanser' }]
    });

    const res = await request(app).get('/products/search?keyword=cleanser');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([{ asin: VALID_ASIN, title: 'Cleanser' }]);
    const params = pool.query.mock.calls[0][1];
    expect(params[0]).toBe('cleanser');
    expect(params[1]).toBe(0);
    expect(params[3]).toBe(0);
  });

  it('rejects requests with no keyword', async () => {
    const res = await request(app).get('/products/search');
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'missing required param: keyword' });
  });

  it('rejects keywords longer than 200 chars', async () => {
    const long = 'a'.repeat(201);
    const res = await request(app).get(`/products/search?keyword=${long}`);
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'invalid param: keyword' });
  });

  it('rejects non-numeric minStars', async () => {
    const res = await request(app).get('/products/search?keyword=x&minStars=abc');
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'invalid param: minStars' });
  });

  it('rejects out-of-range minStars', async () => {
    const res = await request(app).get('/products/search?keyword=x&minStars=9');
    expect(res.status).toBe(400);
  });

  it('rejects negative minStars', async () => {
    const res = await request(app).get('/products/search?keyword=x&minStars=-1');
    expect(res.status).toBe(400);
  });

  it('rejects non-integer limit', async () => {
    const res = await request(app).get('/products/search?keyword=x&limit=2.5');
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'invalid param: limit' });
  });

  it('rejects limit over the max', async () => {
    const res = await request(app).get('/products/search?keyword=x&limit=999');
    expect(res.status).toBe(400);
  });

  it('rejects negative offset', async () => {
    const res = await request(app).get('/products/search?keyword=x&offset=-1');
    expect(res.status).toBe(400);
  });

  it('honors numeric query parameters in order', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    await request(app).get(
      '/products/search?keyword=foo&minStars=4&limit=12&offset=24&optimized=1'
    );
    expect(pool.query.mock.calls[0][1]).toEqual(['foo', 4, 12, 24]);
  });

  it('forwards database errors', async () => {
    pool.query.mockRejectedValueOnce(new Error('db down'));
    const res = await request(app).get('/products/search?keyword=x');
    expect(res.status).toBe(500);
  });
});

describe('GET /deals', () => {
  it('returns deal rows with defaults', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [{ asin: VALID_ASIN, discount_pct: 30 }]
    });

    const res = await request(app).get('/deals');

    expect(res.status).toBe(200);
    expect(res.body[0].discount_pct).toBe(30);
    expect(pool.query.mock.calls[0][1][0]).toBe(500);
  });

  it('passes optimized branch parameters through', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    await request(app).get('/deals?maxPrice=150&minStars=4.5&limit=10&offset=5&optimized=1');
    expect(pool.query.mock.calls[0][1]).toEqual([150, 4.5, 10, 5]);
  });

  it('rejects negative maxPrice', async () => {
    const res = await request(app).get('/deals?maxPrice=-5');
    expect(res.status).toBe(400);
  });

  it('rejects malformed maxPrice', async () => {
    const res = await request(app).get('/deals?maxPrice=cheap');
    expect(res.status).toBe(400);
  });

  it('forwards database errors', async () => {
    pool.query.mockRejectedValueOnce(new Error('db'));
    const res = await request(app).get('/deals');
    expect(res.status).toBe(500);
  });
});

describe('GET /products/category', () => {
  it('returns rows for a known category', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ asin: VALID_ASIN }] });
    const res = await request(app).get(
      '/products/category?category=Beauty&minStars=4&maxPrice=80'
    );
    expect(res.status).toBe(200);
    expect(pool.query.mock.calls[0][1]).toEqual(['Beauty', 4, 80, 24, 0]);
  });

  it('rejects missing category', async () => {
    const res = await request(app).get('/products/category');
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'missing required param: category' });
  });

  it('rejects oversized category names', async () => {
    const big = 'x'.repeat(256);
    const res = await request(app).get(`/products/category?category=${big}`);
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'invalid param: category' });
  });

  it('rejects bad numeric filters', async () => {
    const res = await request(app).get('/products/category?category=Beauty&minStars=10');
    expect(res.status).toBe(400);
  });

  it('forwards database errors', async () => {
    pool.query.mockRejectedValueOnce(new Error('db'));
    const res = await request(app).get('/products/category?category=Beauty');
    expect(res.status).toBe(500);
  });
});

describe('GET /products/brand', () => {
  it('returns rows for a known brand', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ asin: VALID_ASIN }] });
    const res = await request(app).get(
      '/products/brand?brand=Olay&minStars=3&maxPrice=40&limit=8&offset=8&optimized=1'
    );
    expect(res.status).toBe(200);
    expect(pool.query.mock.calls[0][1]).toEqual(['Olay', 3, 40, 8, 8]);
  });

  it('rejects missing brand', async () => {
    const res = await request(app).get('/products/brand');
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'missing required param: brand' });
  });

  it('rejects oversized brand names', async () => {
    const big = 'x'.repeat(256);
    const res = await request(app).get(`/products/brand?brand=${big}`);
    expect(res.status).toBe(400);
  });

  it('rejects bad numeric filters', async () => {
    const res = await request(app).get('/products/brand?brand=Olay&maxPrice=-1');
    expect(res.status).toBe(400);
  });

  it('forwards database errors', async () => {
    pool.query.mockRejectedValueOnce(new Error('db'));
    const res = await request(app).get('/products/brand?brand=Olay');
    expect(res.status).toBe(500);
  });
});

function mockProductExists(exists) {
  pool.query.mockResolvedValueOnce({
    rows: exists ? [{ exists: true }] : [],
    rowCount: exists ? 1 : 0
  });
}

describe('GET /products/:asin/rating-distribution', () => {
  it('returns the distribution when the product exists', async () => {
    mockProductExists(true);
    pool.query.mockResolvedValueOnce({ rows: [{ rating: 5, count: 10 }] });

    const res = await request(app).get(`/products/${VALID_ASIN}/rating-distribution`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([{ rating: 5, count: 10 }]);
    expect(pool.query).toHaveBeenCalledTimes(2);
  });

  it('returns 404 when the product is missing', async () => {
    mockProductExists(false);
    const res = await request(app).get(
      `/products/${VALID_ASIN}/rating-distribution?optimized=1`
    );
    expect(res.status).toBe(404);
  });

  it('rejects malformed ASINs', async () => {
    const res = await request(app).get('/products/lower!case/rating-distribution');
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'invalid param: asin' });
  });

  it('forwards database errors', async () => {
    pool.query.mockRejectedValueOnce(new Error('db'));
    const res = await request(app).get(`/products/${VALID_ASIN}/rating-distribution`);
    expect(res.status).toBe(500);
  });
});

describe('GET /products/:asin/helpful-reviews', () => {
  it('returns reviews when the product exists', async () => {
    mockProductExists(true);
    pool.query.mockResolvedValueOnce({ rows: [{ review_id: 1 }] });
    const res = await request(app).get(`/products/${VALID_ASIN}/helpful-reviews`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([{ review_id: 1 }]);
  });

  it('returns 404 when the product is missing', async () => {
    mockProductExists(false);
    const res = await request(app).get(`/products/${VALID_ASIN}/helpful-reviews`);
    expect(res.status).toBe(404);
  });

  it('rejects malformed ASINs', async () => {
    const res = await request(app).get('/products/abc/helpful-reviews');
    expect(res.status).toBe(400);
  });
});

describe('GET /products/:asin/alternatives', () => {
  it('returns alternatives when the product exists', async () => {
    mockProductExists(true);
    pool.query.mockResolvedValueOnce({ rows: [{ asin: 'B07VMNJHBK' }] });
    const res = await request(app).get(`/products/${VALID_ASIN}/alternatives`);
    expect(res.status).toBe(200);
    expect(res.body[0].asin).toBe('B07VMNJHBK');
  });

  it('returns 404 when the product is missing', async () => {
    mockProductExists(false);
    const res = await request(app).get(`/products/${VALID_ASIN}/alternatives`);
    expect(res.status).toBe(404);
  });

  it('rejects malformed ASINs', async () => {
    const res = await request(app).get('/products/short/alternatives');
    expect(res.status).toBe(400);
  });
});

describe('GET /products/trending', () => {
  it('rejects missing category', async () => {
    const res = await request(app).get('/products/trending');
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'missing required param: category' });
  });

  it('returns trending rows with the default months window', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ asin: VALID_ASIN }] });
    const res = await request(app).get(
      `/products/trending?category=${encodeURIComponent('Hair Care')}`
    );
    expect(res.status).toBe(200);
    expect(pool.query.mock.calls[0][1]).toEqual(['Hair Care', 3]);
  });

  it('honors a custom months window in the optimized branch', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    await request(app).get('/products/trending?category=Beauty&months=6&optimized=1');
    expect(pool.query.mock.calls[0][1]).toEqual(['Beauty', 6]);
  });

  it('rejects non-integer months', async () => {
    const res = await request(app).get('/products/trending?category=Beauty&months=2.5');
    expect(res.status).toBe(400);
  });

  it('rejects months below the minimum', async () => {
    const res = await request(app).get('/products/trending?category=Beauty&months=0');
    expect(res.status).toBe(400);
  });

  it('forwards database errors', async () => {
    pool.query.mockRejectedValueOnce(new Error('db'));
    const res = await request(app).get('/products/trending?category=Beauty');
    expect(res.status).toBe(500);
  });
});

describe('GET /products/top-value', () => {
  it('falls back to a default reviewedSince', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ asin: VALID_ASIN }] });
    const res = await request(app).get('/products/top-value');
    expect(res.status).toBe(200);
    expect(typeof pool.query.mock.calls[0][1][0]).toBe('string');
  });

  it('accepts a parseable reviewedSince', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    await request(app).get('/products/top-value?reviewedSince=2020-01-01');
    expect(pool.query.mock.calls[0][1][0]).toMatch(/^2020-01-01/);
  });

  it('rejects an invalid reviewedSince', async () => {
    const res = await request(app).get('/products/top-value?reviewedSince=not-a-date');
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'invalid param: reviewedSince' });
  });

  it('forwards database errors', async () => {
    pool.query.mockRejectedValueOnce(new Error('db'));
    const res = await request(app).get('/products/top-value');
    expect(res.status).toBe(500);
  });
});

describe('GET /products/value-rankings', () => {
  it('returns ranked rows with default weights', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ asin: VALID_ASIN, score: 0.9 }] });
    const res = await request(app).get('/products/value-rankings');
    expect(res.status).toBe(200);
    expect(pool.query.mock.calls[0][1]).toEqual([0.25, 0.25, 0.25, 0.25]);
  });

  it('passes custom weights through', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    await request(app).get(
      '/products/value-rankings?wRating=0.5&wReviews=0.2&wPriceEff=0.2&wRecent=0.1&optimized=1'
    );
    expect(pool.query.mock.calls[0][1]).toEqual([0.5, 0.2, 0.2, 0.1]);
  });

  it('rejects when all weights are zero', async () => {
    const res = await request(app).get(
      '/products/value-rankings?wRating=0&wReviews=0&wPriceEff=0&wRecent=0'
    );
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'invalid param: weights' });
  });

  it('rejects non-numeric weights', async () => {
    const res = await request(app).get('/products/value-rankings?wRating=heavy');
    expect(res.status).toBe(400);
  });

  it('rejects negative weights', async () => {
    const res = await request(app).get('/products/value-rankings?wRating=-0.1');
    expect(res.status).toBe(400);
  });

  it('forwards database errors', async () => {
    pool.query.mockRejectedValueOnce(new Error('db'));
    const res = await request(app).get('/products/value-rankings');
    expect(res.status).toBe(500);
  });
});
