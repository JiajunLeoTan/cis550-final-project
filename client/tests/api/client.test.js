import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { api, getQueryMode, setQueryMode, BASE_URL } from '../../src/api/client.js';

function mockJsonResponse(body, { ok = true, status = 200 } = {}) {
  return {
    ok,
    status,
    json: () => Promise.resolve(body)
  };
}

let fetchSpy;

beforeEach(() => {
  fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockJsonResponse([]));
});

afterEach(() => {
  fetchSpy.mockRestore();
});

describe('query mode', () => {
  it('defaults to optimized when nothing is in localStorage', () => {
    expect(getQueryMode()).toBe('optimized');
  });

  it('stores "standard" only when standard mode is selected', () => {
    setQueryMode('standard');
    expect(localStorage.getItem('queryMode')).toBe('standard');
    expect(getQueryMode()).toBe('standard');

    setQueryMode('optimized');
    expect(localStorage.getItem('queryMode')).toBe(null);
    expect(getQueryMode()).toBe('optimized');
  });

  it('treats legacy old/new storage values as standard/optimized', () => {
    localStorage.setItem('queryMode', 'old');
    expect(getQueryMode()).toBe('standard');

    localStorage.setItem('queryMode', 'new');
    expect(getQueryMode()).toBe('optimized');
  });

  it('appends ?optimized=1 to plain paths by default', async () => {
    await api.categories();
    expect(fetchSpy).toHaveBeenCalledWith(
      `${BASE_URL}/categories?optimized=1`,
      expect.any(Object)
    );
  });

  it('appends &optimized=1 when a default-optimized path already has a query string', async () => {
    await api.searchProducts({ keyword: 'foo' });
    expect(fetchSpy.mock.calls[0][0]).toBe(
      `${BASE_URL}/products/search?keyword=foo&optimized=1`
    );
  });

  it('does not modify path in old mode', async () => {
    setQueryMode('standard');
    await api.categories();
    expect(fetchSpy.mock.calls[0][0]).toBe(`${BASE_URL}/categories`);
  });
});

describe('query string builder', () => {
  it('drops null, undefined, and empty values', async () => {
    await api.searchProducts({ keyword: 'foo', minStars: undefined, limit: '', offset: null });
    expect(fetchSpy.mock.calls[0][0]).toBe(
      `${BASE_URL}/products/search?keyword=foo&optimized=1`
    );
  });

  it('encodes special characters in keys and values', async () => {
    await api.categoryProducts({ category: 'Hair & Care' });
    const url = fetchSpy.mock.calls[0][0];
    expect(url).toContain('category=Hair%20%26%20Care');
  });

  it('emits no query string when all values are empty', async () => {
    await api.searchProducts({});
    expect(fetchSpy.mock.calls[0][0]).toBe(`${BASE_URL}/products/search?optimized=1`);
  });
});

describe('request method shapes', () => {
  it('GET requests have no body or content-type', async () => {
    await api.categories();
    const opts = fetchSpy.mock.calls[0][1];
    expect(opts.method).toBe('GET');
    expect(opts.body).toBeUndefined();
    expect(opts.headers).toBeUndefined();
  });

  it('cartSavings POSTs JSON with the asins payload', async () => {
    await api.cartSavings(['B0719KWG8H', 'B07VMNJHBK']);
    const [url, opts] = fetchSpy.mock.calls[0];
    expect(url).toBe(`${BASE_URL}/cart/savings?optimized=1`);
    expect(opts.method).toBe('POST');
    expect(opts.headers).toEqual({ 'Content-Type': 'application/json' });
    expect(JSON.parse(opts.body)).toEqual({ asins: ['B0719KWG8H', 'B07VMNJHBK'] });
  });

  it('forwards a provided AbortSignal', async () => {
    const controller = new AbortController();
    await api.categories({ signal: controller.signal });
    expect(fetchSpy.mock.calls[0][1].signal).toBe(controller.signal);
  });

  it('encodes ASIN path params', async () => {
    await api.product('B07/SLASH');
    expect(fetchSpy.mock.calls[0][0]).toBe(
      `${BASE_URL}/products/B07%2FSLASH?optimized=1`
    );
  });
});

describe('error handling', () => {
  it('throws an Error with the server-provided message', async () => {
    fetchSpy.mockResolvedValueOnce(
      mockJsonResponse({ error: 'invalid param: keyword' }, { ok: false, status: 400 })
    );
    const err = await api.searchProducts({ keyword: 'x' }).catch((e) => e);
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toBe('invalid param: keyword');
    expect(err.status).toBe(400);
  });

  it('falls back to a generic message when JSON parsing fails', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: () => Promise.reject(new Error('not json'))
    });
    const err = await api.categories().catch((e) => e);
    expect(err.message).toBe('Request failed (500)');
    expect(err.status).toBe(500);
  });

  it('falls back to generic message when JSON has no error field', async () => {
    fetchSpy.mockResolvedValueOnce(mockJsonResponse({ unrelated: true }, { ok: false, status: 503 }));
    const err = await api.categories().catch((e) => e);
    expect(err.message).toBe('Request failed (503)');
  });
});

describe('endpoint shapes', () => {
  it('deals supports filter parameters', async () => {
    await api.deals({ maxPrice: 100, minStars: 4 });
    expect(fetchSpy.mock.calls[0][0]).toBe(
      `${BASE_URL}/deals?maxPrice=100&minStars=4&optimized=1`
    );
  });

  it('brandProducts builds the brand path', async () => {
    await api.brandProducts({ brand: 'Olay', limit: 8 });
    expect(fetchSpy.mock.calls[0][0]).toBe(
      `${BASE_URL}/products/brand?brand=Olay&limit=8&optimized=1`
    );
  });

  it('trending uses category and months params', async () => {
    await api.trending({ category: 'Beauty', months: 6 });
    expect(fetchSpy.mock.calls[0][0]).toBe(
      `${BASE_URL}/products/trending?category=Beauty&months=6&optimized=1`
    );
  });

  it('topValue passes reviewedSince', async () => {
    await api.topValue({ reviewedSince: '2020-01-01' });
    expect(fetchSpy.mock.calls[0][0]).toContain('reviewedSince=2020-01-01');
  });

  it('valueRankings forwards weights', async () => {
    await api.valueRankings({ wRating: 0.5, wReviews: 0.2, wPriceEff: 0.2, wRecent: 0.1 });
    const url = fetchSpy.mock.calls[0][0];
    expect(url).toContain('wRating=0.5');
    expect(url).toContain('wRecent=0.1');
  });

  it('reviewsTrend filters by category', async () => {
    await api.reviewsTrend({ category: 'Hair Care' });
    expect(fetchSpy.mock.calls[0][0]).toBe(
      `${BASE_URL}/analytics/reviews/trend?category=Hair%20Care&optimized=1`
    );
  });

  it('ratingDistribution and helpfulReviews build per-asin paths', async () => {
    await api.ratingDistribution('B0719KWG8H');
    await api.helpfulReviews('B0719KWG8H');
    await api.alternatives('B0719KWG8H');
    expect(fetchSpy.mock.calls[0][0]).toContain('/products/B0719KWG8H/rating-distribution');
    expect(fetchSpy.mock.calls[1][0]).toContain('/products/B0719KWG8H/helpful-reviews');
    expect(fetchSpy.mock.calls[2][0]).toContain('/products/B0719KWG8H/alternatives');
  });

  it('categoriesCompare and brandsPerformance are simple GETs', async () => {
    await api.categoriesCompare();
    await api.brandsPerformance();
    expect(fetchSpy.mock.calls[0][0]).toBe(
      `${BASE_URL}/analytics/categories/compare?optimized=1`
    );
    expect(fetchSpy.mock.calls[1][0]).toBe(
      `${BASE_URL}/analytics/brands/performance?optimized=1`
    );
  });
});
