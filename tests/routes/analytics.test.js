import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import pool from '../../server/db.js';
import app from '../../server/index.js';
import { clearCache } from '../../server/cache.js';

beforeEach(() => {
  pool.query = vi.fn().mockResolvedValue({ rows: [], rowCount: 0 });
  clearCache();
});

describe('GET /analytics/categories/compare', () => {
  it('returns the compare rows from the original path', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [{ category_name: 'Beauty', product_count: 1000 }]
    });

    const res = await request(app).get('/analytics/categories/compare');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([{ category_name: 'Beauty', product_count: 1000 }]);
  });

  it('caches the optimized result for repeat callers', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [{ category_name: 'Beauty', product_count: 5 }]
    });

    const first = await request(app).get('/analytics/categories/compare?optimized=1');
    const second = await request(app).get('/analytics/categories/compare?optimized=1');

    expect(first.status).toBe(200);
    expect(second.body).toEqual(first.body);
    expect(pool.query).toHaveBeenCalledTimes(1);
  });

  it('forwards database errors', async () => {
    pool.query.mockRejectedValueOnce(new Error('boom'));
    const res = await request(app).get('/analytics/categories/compare');
    expect(res.status).toBe(500);
  });
});

describe('GET /analytics/brands/performance', () => {
  it('returns brand performance rows', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [{ brand_name: 'Olay', avg_review_score: 4.5 }]
    });

    const res = await request(app).get('/analytics/brands/performance?optimized=1');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([{ brand_name: 'Olay', avg_review_score: 4.5 }]);
    expect(res.headers['cache-control']).toBe('no-store');
  });

  it('uses the original SQL when optimized is not set', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    const res = await request(app).get('/analytics/brands/performance');
    expect(res.status).toBe(200);
    expect(pool.query).toHaveBeenCalledTimes(1);
  });
});

describe('GET /analytics/reviews/trend', () => {
  it('rejects requests missing the category parameter', async () => {
    const res = await request(app).get('/analytics/reviews/trend');
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'missing required param: category' });
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('returns trend rows for the given category', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [{ review_month: '2024-01-01', overall_avg_rating: 4.2 }]
    });

    const res = await request(app)
      .get(`/analytics/reviews/trend?category=${encodeURIComponent('Hair Care Products')}`);

    expect(res.status).toBe(200);
    expect(res.body[0].overall_avg_rating).toBe(4.2);
    expect(pool.query.mock.calls[0][1]).toEqual(['Hair Care Products']);
  });

  it('caches optimized results per category', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ review_month: '2024-02-01' }] });

    const first = await request(app).get(
      '/analytics/reviews/trend?category=Beauty&optimized=1'
    );
    const second = await request(app).get(
      '/analytics/reviews/trend?category=Beauty&optimized=1'
    );

    expect(first.status).toBe(200);
    expect(second.body).toEqual(first.body);
    expect(pool.query).toHaveBeenCalledTimes(1);
  });

  it('forwards database errors', async () => {
    pool.query.mockRejectedValueOnce(new Error('boom'));
    const res = await request(app).get('/analytics/reviews/trend?category=X');
    expect(res.status).toBe(500);
  });
});
