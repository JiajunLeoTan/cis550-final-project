import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor, act, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const { api } = vi.hoisted(() => ({
  api: {
    valueRankings: vi.fn(),
    topValue: vi.fn()
  }
}));

vi.mock('../../src/api/client.js', () => ({
  api,
  getQueryMode: () => 'standard',
  setQueryMode: () => {},
  BASE_URL: 'http://test'
}));

import ValueRankings from '../../src/pages/ValueRankings.jsx';
import { renderWith } from '../test-utils.jsx';

const ROW = {
  asin: 'B0000A',
  title: 'Top Pick',
  price: 12,
  value_score: 0.83,
  stars: 4.5,
  review_count: 200,
  category_name: 'Beauty',
  brand_name: 'Acme',
  img_url: 'https://x/a.jpg'
};

const TOP_VALUE_ROW = {
  asin: 'B0000V',
  title: 'Category Value Pick',
  price: 9,
  stars: 4.7,
  review_count: 140,
  category_name: 'Beauty',
  img_url: 'https://x/v.jpg'
};

beforeEach(() => {
  api.valueRankings.mockReset().mockResolvedValue([ROW]);
  api.topValue.mockReset().mockResolvedValue([TOP_VALUE_ROW]);
});

describe('ValueRankings', () => {
  it('renders the page header and balanced preset weights', async () => {
    renderWith(<ValueRankings />);
    expect(screen.getByRole('heading', { name: 'Value rankings' })).toBeInTheDocument();
    expect(screen.getByLabelText(/Rating strength/)).toBeInTheDocument();
    await waitFor(() => expect(api.valueRankings).toHaveBeenCalled());
    await waitFor(() => expect(api.topValue).toHaveBeenCalledWith(
      { reviewedSince: '2018-01-01' },
      expect.any(Object)
    ));
    expect(api.valueRankings.mock.calls[0][0]).toEqual({
      wRating: 0.4,
      wReviews: 0.2,
      wPriceEff: 0.2,
      wRecent: 0.2
    });
  });

  it('renders the top result and ranked rows', async () => {
    renderWith(<ValueRankings />);
    expect(await screen.findByRole('heading', { name: 'Top result' })).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Top 25' })).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Top value products' })).toBeInTheDocument();
    expect((await screen.findAllByText('Top Pick')).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/83\.0/).length).toBeGreaterThan(0);
    expect(await screen.findByText('Category Value Pick')).toBeInTheDocument();
    expect(screen.getByText('Top value')).toBeInTheDocument();
  });

  it('switches weights via the Quality first preset', async () => {
    vi.useFakeTimers();
    try {
      renderWith(<ValueRankings />);
      await act(async () => {
        await Promise.resolve();
      });
      api.valueRankings.mockClear();
      await act(async () => {
        screen.getByRole('button', { name: 'Quality first' }).click();
      });
      await act(async () => {
        vi.advanceTimersByTime(500);
      });
      vi.useRealTimers();
      await waitFor(() => expect(api.valueRankings).toHaveBeenCalled());
      const last = api.valueRankings.mock.calls.at(-1)[0];
      expect(last).toEqual({
        wRating: 0.5,
        wReviews: 0.3,
        wPriceEff: 0.1,
        wRecent: 0.1
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it('shows the empty state when no rows match', async () => {
    api.valueRankings.mockResolvedValue([]);
    renderWith(<ValueRankings />);
    expect(
      await screen.findByText('No products match these weights.')
    ).toBeInTheDocument();
    expect(screen.getByText('No products matched.')).toBeInTheDocument();
  });

  it('refetches top-value products when the reviewed-since date changes', async () => {
    renderWith(<ValueRankings />);
    await waitFor(() => expect(api.topValue).toHaveBeenCalled());
    api.topValue.mockClear();
    fireEvent.change(screen.getByLabelText(/Reviewed since/), {
      target: { value: '2020-01-01' }
    });
    await waitFor(() =>
      expect(api.topValue).toHaveBeenCalledWith(
        { reviewedSince: '2020-01-01' },
        expect.any(Object)
      )
    );
  });

  it('shows the top-value empty state when no top-value products match', async () => {
    api.topValue.mockResolvedValue([]);
    renderWith(<ValueRankings />);
    expect(
      await screen.findByText('No top-value products match this review window.')
    ).toBeInTheDocument();
  });

  it('renders the top-value error banner when the top-value query fails', async () => {
    api.topValue.mockRejectedValueOnce(new Error('top value err'));
    renderWith(<ValueRankings />);
    expect(await screen.findByText('top value err')).toBeInTheDocument();
  });

  it('renders the error banner when ranking fails', async () => {
    api.valueRankings.mockRejectedValueOnce(new Error('rank err'));
    renderWith(<ValueRankings />);
    const banners = await screen.findAllByText('rank err');
    expect(banners.length).toBeGreaterThan(0);
  });

  it('reflects manual slider edits', async () => {
    renderWith(<ValueRankings />);
    await waitFor(() => expect(api.valueRankings).toHaveBeenCalled());
    const slider = screen.getByLabelText(/Rating strength/);
    fireEvent.change(slider, { target: { value: '0.75' } });
    expect(screen.getByText('0.75')).toBeInTheDocument();
  });
});
