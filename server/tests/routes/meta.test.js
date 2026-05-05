import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import pool from '../../db.js';
import app from '../../index.js';
import { clearCache } from '../../cache.js';

beforeEach(() => {
  pool.query = vi.fn().mockResolvedValue({ rows: [], rowCount: 0 });
  clearCache();
});

describe('GET /categories', () => {
  it('returns rows from the original query path', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [{ category_id: 1, category_name: 'Beauty' }]
    });

    const res = await request(app).get('/categories');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([{ category_id: 1, category_name: 'Beauty' }]);
    expect(pool.query).toHaveBeenCalledTimes(1);
  });

  it('uses the optimized query and caches the result', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [{ category_id: 2, category_name: 'Hair Care' }]
    });

    const first = await request(app).get('/categories?optimized=1');
    const second = await request(app).get('/categories?optimized=1');

    expect(first.status).toBe(200);
    expect(second.body).toEqual(first.body);
    expect(pool.query).toHaveBeenCalledTimes(1);
  });

  it('forwards database errors to the error handler', async () => {
    pool.query.mockRejectedValueOnce(new Error('boom'));

    const res = await request(app).get('/categories');

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Internal server error' });
  });

  it('sets CORS headers for an allowed frontend origin', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .get('/categories')
      .set('Origin', 'http://localhost:5173');

    expect(res.status).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
  });

  it('omits CORS headers for a disallowed frontend origin', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .get('/categories')
      .set('Origin', 'https://not-the-frontend.example.com');

    expect(res.status).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('allows no-origin requests without CORS headers', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app).get('/categories');

    expect(res.status).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('responds to allowed preflight requests', async () => {
    const res = await request(app)
      .options('/categories')
      .set('Origin', 'http://localhost:5173')
      .set('Access-Control-Request-Method', 'GET')
      .set('Access-Control-Request-Headers', 'Content-Type');

    expect(res.status).toBe(204);
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    expect(res.headers['access-control-allow-methods']).toContain('GET');
    expect(res.headers['access-control-allow-methods']).toContain('POST');
    expect(res.headers['access-control-allow-methods']).toContain('OPTIONS');
    expect(res.headers['access-control-allow-headers']).toBe('Content-Type');
    expect(pool.query).not.toHaveBeenCalled();
  });
});

describe('GET /brands', () => {
  it('returns rows from the original query path', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [{ brand_id: 1, brand_name: 'Aveeno' }]
    });

    const res = await request(app).get('/brands');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([{ brand_id: 1, brand_name: 'Aveeno' }]);
  });

  it('uses the optimized query and caches the result', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ brand_id: 9, brand_name: 'Olay' }] });

    const first = await request(app).get('/brands?optimized=1');
    const second = await request(app).get('/brands?optimized=true');

    expect(first.status).toBe(200);
    expect(second.body).toEqual(first.body);
    expect(pool.query).toHaveBeenCalledTimes(1);
  });
});

describe('GET /products/:asin', () => {
  it('returns the product when it exists', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [{ asin: 'B0719KWG8H', title: 'Cleanser' }]
    });

    const res = await request(app).get('/products/B0719KWG8H');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ asin: 'B0719KWG8H', title: 'Cleanser' });
  });

  it('returns 404 when no rows are returned', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app).get('/products/B0719KWG8H?optimized=1');

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'product not found' });
  });

  it('rejects malformed ASINs', async () => {
    const res = await request(app).get('/products/lowercase!');

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'invalid param: asin' });
    expect(pool.query).not.toHaveBeenCalled();
  });
});
