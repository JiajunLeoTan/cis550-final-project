import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const { api } = vi.hoisted(() => ({
  api: {
    categories: vi.fn(),
    categoriesCompare: vi.fn(),
    brandsPerformance: vi.fn(),
    reviewsTrend: vi.fn()
  }
}));

vi.mock('../../src/api/client.js', () => ({
  api,
  getQueryMode: () => 'old',
  setQueryMode: () => {},
  BASE_URL: 'http://test'
}));

import Analytics from '../../src/pages/Analytics.jsx';
import { renderWith } from '../test-utils.jsx';

const CATEGORIES = [
  { category_id: 1, category_name: 'Beauty' },
  { category_id: 2, category_name: 'Hair Care' }
];

const COMPARE_ROWS = [
  { category_name: 'Beauty', product_count: 1000, avg_rating: 4.3, avg_price: 18 },
  { category_name: 'Hair Care', product_count: 600, avg_rating: 4.1, avg_price: 22 }
];

const BRAND_ROWS = [
  {
    brand_name: 'Olay',
    avg_review_score: 4.6,
    qualifying_review_count: 320,
    total_helpful_votes: 200,
    avg_product_rating: 4.4,
    total_products: 30
  },
  {
    brand_name: 'Aveeno',
    avg_review_score: 4.4,
    qualifying_review_count: 180,
    total_helpful_votes: 100,
    avg_product_rating: 4.3,
    total_products: 12
  },
  // Should be filtered: looks like a pack/count name
  {
    brand_name: '3 pack value',
    avg_review_score: 4.9,
    qualifying_review_count: 5,
    total_helpful_votes: 1,
    avg_product_rating: 5,
    total_products: 1
  }
];

const TREND_ROWS = [
  {
    review_month: '2024-01-01',
    overall_avg_rating: 4.2,
    high_cred_avg: 4.4,
    low_cred_avg: 4.0,
    total_reviews: 100,
    verified_count: 60
  },
  {
    review_month: '2024-02-01',
    overall_avg_rating: 4.3,
    high_cred_avg: 4.5,
    low_cred_avg: 4.0,
    total_reviews: 120,
    verified_count: 80
  }
];

beforeEach(() => {
  api.categories.mockReset().mockResolvedValue(CATEGORIES);
  api.categoriesCompare.mockReset().mockResolvedValue(COMPARE_ROWS);
  api.brandsPerformance.mockReset().mockResolvedValue(BRAND_ROWS);
  api.reviewsTrend.mockReset().mockResolvedValue(TREND_ROWS);
});

describe('Analytics', () => {
  it('renders the editorial header and three numbered sections', async () => {
    renderWith(<Analytics />);
    expect(
      screen.getByRole('heading', { name: /Analytics/ })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: /Categories compared/ })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: /Brand leaderboard/ })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: /High-activity vs lower-activity/ })
    ).toBeInTheDocument();
  });

  it('switches the categories chart metric when a tab is clicked', async () => {
    renderWith(<Analytics />);
    await waitFor(() => expect(api.categoriesCompare).toHaveBeenCalled());
    await userEvent.click(screen.getByRole('button', { name: 'Average rating' }));
    expect(
      screen.getByRole('button', { name: 'Average rating' }).className
    ).toContain('active');
  });

  it('renders the brand leaderboard sorted by review score and excludes pack-style names', async () => {
    renderWith(<Analytics />);
    const olayLinks = await screen.findAllByRole('link', { name: 'Olay' });
    expect(olayLinks.length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: 'Aveeno' })).toBeInTheDocument();
    expect(screen.queryByText('3 pack value')).toBeNull();
  });

  it('renders the trend stats and chart for the chosen category', async () => {
    renderWith(<Analytics />);
    await waitFor(() => expect(api.reviewsTrend).toHaveBeenCalled());
    expect(api.reviewsTrend.mock.calls[0][0]).toEqual({ category: 'Beauty' });
    expect(await screen.findByText(/220/)).toBeInTheDocument();
    expect(screen.getByText('Reviews')).toBeInTheDocument();
    expect(screen.getByText('High-activity avg')).toBeInTheDocument();
    expect(screen.getByText('Lower-activity avg')).toBeInTheDocument();
    expect(screen.getByText('Gap')).toBeInTheDocument();
  });

  it('changes the trend category via the select', async () => {
    renderWith(<Analytics />);
    await waitFor(() => expect(api.reviewsTrend).toHaveBeenCalled());
    api.reviewsTrend.mockClear();
    const select = screen.getByLabelText('Category');
    await userEvent.selectOptions(select, 'Hair Care');
    await waitFor(() =>
      expect(api.reviewsTrend.mock.calls.at(-1)[0]).toEqual({ category: 'Hair Care' })
    );
  });

  it('renders empty states when underlying data is empty', async () => {
    api.categoriesCompare.mockResolvedValueOnce([]);
    api.brandsPerformance.mockResolvedValueOnce([]);
    api.reviewsTrend.mockResolvedValueOnce([]);
    renderWith(<Analytics />);
    expect(
      await screen.findByText(/No data for this metric/)
    ).toBeInTheDocument();
    expect(
      await screen.findByText(/No qualifying brands yet/)
    ).toBeInTheDocument();
    expect(
      await screen.findByText(/No review timeline for this category/)
    ).toBeInTheDocument();
  });

  it('renders the categories error banner when the request fails', async () => {
    api.categoriesCompare.mockRejectedValueOnce(new Error('cats down'));
    renderWith(<Analytics />);
    expect(await screen.findByText('cats down')).toBeInTheDocument();
  });
});
