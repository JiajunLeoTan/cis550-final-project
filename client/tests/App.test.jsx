import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const { api } = vi.hoisted(() => ({
  api: {
    categories: vi.fn().mockResolvedValue([]),
    brands: vi.fn().mockResolvedValue([]),
    product: vi.fn().mockResolvedValue(null),
    searchProducts: vi.fn().mockResolvedValue([]),
    deals: vi.fn().mockResolvedValue([]),
    categoryProducts: vi.fn().mockResolvedValue([]),
    brandProducts: vi.fn().mockResolvedValue([]),
    ratingDistribution: vi.fn().mockResolvedValue([]),
    helpfulReviews: vi.fn().mockResolvedValue([]),
    alternatives: vi.fn().mockResolvedValue([]),
    trending: vi.fn().mockResolvedValue([]),
    topValue: vi.fn().mockResolvedValue([]),
    valueRankings: vi.fn().mockResolvedValue([]),
    cartSavings: vi.fn().mockResolvedValue({}),
    categoriesCompare: vi.fn().mockResolvedValue([]),
    brandsPerformance: vi.fn().mockResolvedValue([]),
    reviewsTrend: vi.fn().mockResolvedValue([])
  }
}));

vi.mock('../src/api/client.js', () => ({
  api,
  getQueryMode: () => 'old',
  setQueryMode: () => {},
  BASE_URL: 'http://test'
}));

import App from '../src/App.jsx';
import { CartProvider } from '../src/context/CartContext.jsx';

function renderApp(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <CartProvider>
        <App />
      </CartProvider>
    </MemoryRouter>
  );
}

beforeEach(() => {
  api.categories.mockReset().mockResolvedValue([]);
  api.brands.mockReset().mockResolvedValue([]);
  api.product.mockReset().mockResolvedValue(null);
  api.searchProducts.mockReset().mockResolvedValue([]);
  api.deals.mockReset().mockResolvedValue([]);
  api.categoryProducts.mockReset().mockResolvedValue([]);
  api.brandProducts.mockReset().mockResolvedValue([]);
  api.ratingDistribution.mockReset().mockResolvedValue([]);
  api.helpfulReviews.mockReset().mockResolvedValue([]);
  api.alternatives.mockReset().mockResolvedValue([]);
  api.trending.mockReset().mockResolvedValue([]);
  api.topValue.mockReset().mockResolvedValue([]);
  api.valueRankings.mockReset().mockResolvedValue([]);
  api.cartSavings.mockReset().mockResolvedValue({});
  api.categoriesCompare.mockReset().mockResolvedValue([]);
  api.brandsPerformance.mockReset().mockResolvedValue([]);
  api.reviewsTrend.mockReset().mockResolvedValue([]);
});

describe('App routing', () => {
  it('renders Home at /', () => {
    renderApp('/');
    expect(screen.getByRole('heading', { name: /A reading room/ })).toBeInTheDocument();
  });

  it('renders Browse at /browse', async () => {
    renderApp('/browse');
    expect(await screen.findByRole('heading', { name: 'Browse' })).toBeInTheDocument();
  });

  it('renders Deals at /deals', async () => {
    renderApp('/deals');
    expect(await screen.findByRole('heading', { name: 'Deals.' })).toBeInTheDocument();
  });

  it('renders CategoryPage at /category/:categoryName with the decoded category', async () => {
    renderApp('/category/Beauty');

    expect(
      await screen.findByText(/No products found for this category/i)
    ).toBeInTheDocument();
    await waitFor(() => expect(api.categoryProducts).toHaveBeenCalled());
    expect(api.categoryProducts.mock.calls[0][0]).toMatchObject({
      category: 'Beauty',
      limit: 24,
      offset: 0
    });
  });

  it('renders BrandPage at /brand/:brandName with the decoded brand', async () => {
    renderApp('/brand/Aveeno');

    expect(await screen.findByText(/No products found for this brand/i)).toBeInTheDocument();
    await waitFor(() => expect(api.brandProducts).toHaveBeenCalled());
    expect(api.brandProducts.mock.calls[0][0]).toMatchObject({
      brand: 'Aveeno',
      limit: 24,
      offset: 0
    });
  });

  it('renders ProductDetail at /product/:asin with the ASIN', async () => {
    renderApp('/product/B0719KWG8H');

    expect(await screen.findByText(/Product not found/i)).toBeInTheDocument();
    await waitFor(() => expect(api.product).toHaveBeenCalled());
    expect(api.product.mock.calls[0][0]).toBe('B0719KWG8H');
  });

  it('renders Cart at /cart', async () => {
    renderApp('/cart');
    expect(await screen.findByRole('heading', { name: 'Cart' })).toBeInTheDocument();
  });

  it('renders Analytics at /analytics', async () => {
    renderApp('/analytics');
    expect(await screen.findByRole('heading', { name: /Analytics/ })).toBeInTheDocument();
  });

  it('renders ValueRankings at /value', async () => {
    renderApp('/value');
    expect(
      await screen.findByRole('heading', { name: 'Value rankings' })
    ).toBeInTheDocument();
  });

  it('renders NotFound for an unknown route', () => {
    renderApp('/this-does-not-exist');
    expect(screen.getByRole('heading', { name: /404/ })).toBeInTheDocument();
  });
});
