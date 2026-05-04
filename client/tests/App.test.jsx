import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
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
