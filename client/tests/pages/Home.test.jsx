import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

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

vi.mock('../../src/api/client.js', () => ({
  api,
  getQueryMode: () => 'old',
  setQueryMode: () => {},
  BASE_URL: 'http://test'
}));

import Home from '../../src/pages/Home.jsx';
import { renderWith } from '../test-utils.jsx';
import { useLocation } from 'react-router-dom';

beforeEach(() => {
  Object.values(api).forEach((fn) => fn.mockReset?.());
  api.trending.mockResolvedValue([]);
  api.deals.mockResolvedValue([]);
});

describe('Home', () => {
  it('renders the editorial hero and reading-room copy', async () => {
    renderWith(<Home />);
    expect(
      screen.getByRole('heading', { name: /A reading room/ })
    ).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText(/Search products by keyword/)
    ).toBeInTheDocument();
    await waitFor(() => expect(api.trending).toHaveBeenCalled());
    await waitFor(() => expect(api.deals).toHaveBeenCalled());
  });

  it('shows skeletons while loading', () => {
    api.trending.mockImplementation(() => new Promise(() => {}));
    api.deals.mockImplementation(() => new Promise(() => {}));
    const { container } = renderWith(<Home />);
    expect(container.querySelectorAll('.skeleton').length).toBeGreaterThan(0);
  });

  it('shows the empty proven-picks card when trending is empty', async () => {
    api.trending.mockResolvedValue([]);
    api.deals.mockResolvedValue([]);
    renderWith(<Home />);
    expect(
      await screen.findByText(/Not enough review coverage/)
    ).toBeInTheDocument();
    expect(await screen.findByText('No deals available right now.')).toBeInTheDocument();
  });

  it('renders product cards from trending and deals', async () => {
    api.trending.mockResolvedValue([
      { asin: 'B000PROVEN', title: 'Proven A', price: 10 }
    ]);
    api.deals.mockResolvedValue([
      { asin: 'B000DEAL1', title: 'Deal A', price: 5, list_price: 10, discount_pct: 50 }
    ]);
    renderWith(<Home />);
    expect(await screen.findByText('Proven A')).toBeInTheDocument();
    expect(await screen.findByText('Deal A')).toBeInTheDocument();
    expect(await screen.findByText('50% off')).toBeInTheDocument();
  });

  it('navigates to /browse with the query when the user submits the search', async () => {
    let captured;
    function Probe() {
      captured = useLocation();
      return null;
    }
    renderWith(
      <>
        <Home />
        <Probe />
      </>
    );
    const input = screen.getByPlaceholderText(/Search products by keyword/);
    await userEvent.type(input, 'cleanser');
    await userEvent.click(screen.getByRole('button', { name: 'Search' }));
    await waitFor(() =>
      expect(captured?.pathname + captured?.search).toBe('/browse?q=cleanser')
    );
  });

  it('does not navigate on empty query submit', async () => {
    let captured;
    function Probe() {
      captured = useLocation();
      return null;
    }
    renderWith(
      <>
        <Home />
        <Probe />
      </>
    );
    await userEvent.click(screen.getByRole('button', { name: 'Search' }));
    expect(captured.pathname).toBe('/');
  });
});
