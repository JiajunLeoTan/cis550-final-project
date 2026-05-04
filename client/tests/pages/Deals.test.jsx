import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor, act } from '@testing-library/react';
import { fireEvent } from '@testing-library/react';

const { api } = vi.hoisted(() => ({
  api: {
    deals: vi.fn().mockResolvedValue([])
  }
}));

vi.mock('../../src/api/client.js', () => ({
  api,
  getQueryMode: () => 'old',
  setQueryMode: () => {},
  BASE_URL: 'http://test'
}));

import Deals from '../../src/pages/Deals.jsx';
import { renderWith } from '../test-utils.jsx';

beforeEach(() => {
  api.deals.mockReset().mockResolvedValue([]);
});

describe('Deals', () => {
  it('renders headers and immediately calls the deals API once', async () => {
    renderWith(<Deals />);
    expect(screen.getByRole('heading', { name: /Deals/ })).toBeInTheDocument();
    expect(screen.getByLabelText(/Max price/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Minimum rating/)).toBeInTheDocument();
    await waitFor(() => expect(api.deals).toHaveBeenCalledTimes(1));
    expect(api.deals.mock.calls[0][0]).toEqual({ maxPrice: 250, minStars: undefined });
  });

  it('renders the empty state when no deals come back', async () => {
    renderWith(<Deals />);
    expect(
      await screen.findByText('No deals match those filters.')
    ).toBeInTheDocument();
  });

  it('renders the error banner when the request fails', async () => {
    api.deals.mockRejectedValueOnce(new Error('db down'));
    renderWith(<Deals />);
    expect(await screen.findByText('db down')).toBeInTheDocument();
  });

  it('renders product cards with the discount badge', async () => {
    api.deals.mockResolvedValue([
      {
        asin: 'B000DEAL1',
        title: 'Cleanser',
        price: 5,
        list_price: 10,
        discount_pct: 50
      }
    ]);
    renderWith(<Deals />);
    expect(await screen.findByText('Cleanser')).toBeInTheDocument();
    expect(await screen.findByText('50% off')).toBeInTheDocument();
  });

  it('debounces slider input — only one fetch after a single change', async () => {
    vi.useFakeTimers();
    try {
      renderWith(<Deals />);
      await act(async () => {
        await Promise.resolve();
      });
      expect(api.deals).toHaveBeenCalledTimes(1);

      const slider = screen.getByLabelText(/Max price/);
      fireEvent.change(slider, { target: { value: '300' } });
      fireEvent.change(slider, { target: { value: '350' } });
      fireEvent.change(slider, { target: { value: '400' } });

      // Before debounce expires, no extra fetch.
      expect(api.deals).toHaveBeenCalledTimes(1);

      await act(async () => {
        vi.advanceTimersByTime(400);
      });
      expect(api.deals).toHaveBeenCalledTimes(2);
      expect(api.deals.mock.calls[1][0].maxPrice).toBe(400);
    } finally {
      vi.useRealTimers();
    }
  });
});
