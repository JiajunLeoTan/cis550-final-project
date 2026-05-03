import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import pool from '../../server/db.js';
import app from '../../server/index.js';

const VALID_ASIN = 'B0719KWG8H';
const ANOTHER_ASIN = 'B07VMNJHBK';

beforeEach(() => {
  pool.query = vi.fn().mockResolvedValue({ rows: [], rowCount: 0 });
});

describe('POST /cart/savings', () => {
  it('returns the savings row from the optimized query path', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [{ items: 2, current_total: 50, list_total: 70, savings: 20 }]
    });

    const res = await request(app)
      .post('/cart/savings?optimized=1')
      .send({ asins: [VALID_ASIN, ANOTHER_ASIN] });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ items: 2, current_total: 50, list_total: 70, savings: 20 });
    expect(pool.query).toHaveBeenCalledTimes(1);
    expect(pool.query.mock.calls[0][1]).toEqual([[VALID_ASIN, ANOTHER_ASIN]]);
  });

  it('runs the original query path when optimized is not set', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ items: 0, current_total: 0, list_total: 0, savings: 0 }] });

    const res = await request(app)
      .post('/cart/savings')
      .send({ asins: [] });

    expect(res.status).toBe(200);
    expect(res.body.items).toBe(0);
  });

  it('rejects when asins is missing', async () => {
    const res = await request(app).post('/cart/savings').send({});

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'missing required param: asins' });
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('rejects when asins is not an array', async () => {
    const res = await request(app)
      .post('/cart/savings')
      .send({ asins: 'not-an-array' });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'invalid param: asins' });
  });

  it('rejects malformed ASIN entries', async () => {
    const res = await request(app)
      .post('/cart/savings')
      .send({ asins: ['lowercase!'] });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'invalid param: asins' });
  });

  it('rejects oversized cart', async () => {
    const huge = Array.from({ length: 201 }, () => VALID_ASIN);
    const res = await request(app).post('/cart/savings').send({ asins: huge });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'invalid param: asins' });
  });

  it('forwards database errors', async () => {
    pool.query.mockRejectedValueOnce(new Error('boom'));

    const res = await request(app)
      .post('/cart/savings')
      .send({ asins: [VALID_ASIN] });

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Internal server error' });
  });
});
