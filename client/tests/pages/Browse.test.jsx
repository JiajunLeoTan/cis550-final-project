import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor, act, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const { api } = vi.hoisted(() => ({
  api: {
    categories: vi.fn(),
    categoryProducts: vi.fn(),
    searchProducts: vi.fn()
  }
}));

vi.mock('../../src/api/client.js', () => ({
  api,
  getQueryMode: () => 'old',
  setQueryMode: () => {},
  BASE_URL: 'http://test'
}));

import Browse from '../../src/pages/Browse.jsx';
import { renderWith } from '../test-utils.jsx';

const CAT_BEAUTY = { category_id: 1, category_name: 'Beauty' };
const CAT_HAIR = { category_id: 2, category_name: 'Hair Care' };

beforeEach(() => {
  api.categories.mockReset().mockResolvedValue([CAT_BEAUTY, CAT_HAIR]);
  api.categoryProducts.mockReset().mockResolvedValue([]);
  api.searchProducts.mockReset().mockResolvedValue([]);
});

describe('Browse', () => {
  it('renders the browse hero, filters, and the category section', async () => {
    renderWith(<Browse />);
    expect(screen.getByRole('heading', { name: 'Browse' })).toBeInTheDocument();
    expect(screen.getByLabelText(/Search products/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Minimum rating/)).toBeInTheDocument();
    expect(
      await screen.findByRole('heading', { name: 'Shop by category' })
    ).toBeInTheDocument();
    const beautyLinks = await screen.findAllByRole('link', { name: 'Beauty' });
    expect(beautyLinks.length).toBeGreaterThan(0);
  });

  it('renders products in category card previews', async () => {
    api.categoryProducts.mockResolvedValue([
      { asin: 'B0000PREV', title: 'Preview Item', price: 9 }
    ]);
    renderWith(<Browse />);
    expect(await screen.findAllByText('Preview Item')).toHaveLength(2);
  });

  it('shows the category empty hint when previews are empty', async () => {
    api.categoryProducts.mockResolvedValue([]);
    renderWith(<Browse />);
    const empties = await screen.findAllByText('No products match these filters.');
    expect(empties.length).toBeGreaterThan(0);
  });

  it('switches to search mode after debounced typing and clears it', async () => {
    api.searchProducts.mockResolvedValue([
      { asin: 'B0000SRCH', title: 'Search Hit', price: 5 }
    ]);
    vi.useFakeTimers();
    try {
      renderWith(<Browse />);
      const input = screen.getByLabelText(/Search products/);
      fireEvent.change(input, { target: { value: 'cleanser' } });

      await act(async () => {
        vi.advanceTimersByTime(400);
      });
      vi.useRealTimers();

      await waitFor(() => expect(api.searchProducts).toHaveBeenCalled());
      expect(await screen.findByRole('heading', { name: 'Search results' })).toBeInTheDocument();
      expect(await screen.findByText('Search Hit')).toBeInTheDocument();

      await userEvent.click(screen.getByRole('button', { name: 'Clear search' }));
      expect(input.value).toBe('');
    } finally {
      vi.useRealTimers();
    }
  });

  it('shows an empty state when search has no results', async () => {
    api.searchProducts.mockResolvedValue([]);
    vi.useFakeTimers();
    try {
      renderWith(<Browse />);
      fireEvent.change(screen.getByLabelText(/Search products/), {
        target: { value: 'nope' }
      });
      await act(async () => {
        vi.advanceTimersByTime(400);
      });
      vi.useRealTimers();
      expect(
        await screen.findByText('No products match that search.')
      ).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('shows the categories error banner when categories fail', async () => {
    api.categories.mockRejectedValueOnce(new Error('cats down'));
    renderWith(<Browse />);
    expect(await screen.findByText('cats down')).toBeInTheDocument();
  });
});
