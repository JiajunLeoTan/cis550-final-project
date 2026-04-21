const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

async function request(path, { method = 'GET', body, signal } = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    signal
  });

  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const data = await res.json();
      if (data && data.error) message = data.error;
    } catch {
      /* noop */
    }
    const err = new Error(message);
    err.status = res.status;
    throw err;
  }

  return res.json();
}

function qs(params) {
  const parts = Object.entries(params || {})
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`);
  return parts.length ? `?${parts.join('&')}` : '';
}

export const api = {
  categories: (opts) => request('/categories', opts),
  brands: (opts) => request('/brands', opts),

  product: (asin, opts) => request(`/products/${encodeURIComponent(asin)}`, opts),
  searchProducts: ({ keyword, minStars } = {}, opts) =>
    request(`/products/search${qs({ keyword, minStars })}`, opts),
  deals: ({ maxPrice } = {}, opts) => request(`/deals${qs({ maxPrice })}`, opts),
  ratingDistribution: (asin, opts) =>
    request(`/products/${encodeURIComponent(asin)}/rating-distribution`, opts),
  helpfulReviews: (asin, opts) =>
    request(`/products/${encodeURIComponent(asin)}/helpful-reviews`, opts),
  alternatives: (asin, opts) =>
    request(`/products/${encodeURIComponent(asin)}/alternatives`, opts),

  trending: ({ category, months } = {}, opts) =>
    request(`/products/trending${qs({ category, months })}`, opts),
  topValue: ({ reviewedSince } = {}, opts) =>
    request(`/products/top-value${qs({ reviewedSince })}`, opts),
  valueRankings: ({ wRating, wReviews, wPriceEff, wRecent } = {}, opts) =>
    request(
      `/products/value-rankings${qs({ wRating, wReviews, wPriceEff, wRecent })}`,
      opts
    ),

  cartSavings: (asins, opts) =>
    request('/cart/savings', { ...opts, method: 'POST', body: { asins } }),

  categoriesCompare: (opts) => request('/analytics/categories/compare', opts),
  brandsPerformance: (opts) => request('/analytics/brands/performance', opts),
  reviewsTrend: ({ category } = {}, opts) =>
    request(`/analytics/reviews/trend${qs({ category })}`, opts)
};

export { BASE_URL };
