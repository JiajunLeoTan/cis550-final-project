import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const { api } = vi.hoisted(() => ({
  api: { cartSavings: vi.fn() }
}));

vi.mock('../../src/api/client.js', () => ({
  api,
  getQueryMode: () => 'standard',
  setQueryMode: () => {},
  BASE_URL: 'http://test'
}));

import Cart from '../../src/pages/Cart.jsx';
import { renderWith } from '../test-utils.jsx';

const STORAGE_KEY = 'axiom.cart.v1';

const ITEM_A = {
  asin: 'B0719KWG8H',
  title: 'Cleanser A',
  price: 10,
  list_price: 14,
  img_url: 'https://x/a.jpg',
  category_name: 'Beauty',
  brand_name: 'Acme'
};
const ITEM_B = {
  asin: 'B07VMNJHBK',
  title: 'Toner B',
  price: 20,
  list_price: null,
  img_url: null,
  category_name: null,
  brand_name: null
};

beforeEach(() => {
  api.cartSavings.mockReset().mockResolvedValue({
    total_list_price: 14,
    total_current_price: 10,
    total_savings: 4
  });
});

describe('Cart', () => {
  it('shows the empty state and a browse link when no items are saved', async () => {
    renderWith(<Cart />);
    expect(await screen.findByText('Cart is empty.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Start browsing' })).toHaveAttribute(
      'href',
      '/browse'
    );
    expect(api.cartSavings).not.toHaveBeenCalled();
  });

  it('renders rows for each item and totals from the API', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([ITEM_A, ITEM_B]));
    renderWith(<Cart />);
    expect(await screen.findByText('Cleanser A')).toBeInTheDocument();
    expect(await screen.findByText('Toner B')).toBeInTheDocument();

    await waitFor(() =>
      expect(api.cartSavings).toHaveBeenCalledWith([ITEM_A.asin, ITEM_B.asin])
    );
    await waitFor(() =>
      expect(screen.getAllByText('$10.00').length).toBeGreaterThan(0)
    );
    await waitFor(() =>
      expect(screen.getAllByText('$14.00').length).toBeGreaterThan(0)
    );
    expect(screen.getByText(/You save/i)).toBeInTheDocument();
    expect(screen.getByText(/\$4\.00/)).toBeInTheDocument();
  });

  it('shows unavailable for zero-priced cart items without a fake discount', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([{ ...ITEM_A, price: 0 }]));
    renderWith(<Cart />);
    expect(await screen.findByText('Cleanser A')).toBeInTheDocument();
    const itemDetails = screen.getByText('Cleanser A').closest('div');
    expect(within(itemDetails).getByText('Price unavailable')).toBeInTheDocument();
    expect(within(itemDetails).queryByText('$0.00')).toBeNull();
    expect(within(itemDetails).queryByText('$14.00')).toBeNull();
  });

  it('renders the ASIN suffix when an item lacks an image', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([ITEM_B]));
    renderWith(<Cart />);
    expect(await screen.findByText('JHBK')).toBeInTheDocument();
  });

  it('removes an item when the row Remove button is clicked', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([ITEM_A, ITEM_B]));
    renderWith(<Cart />);
    const removeButtons = await screen.findAllByRole('button', { name: 'Remove' });
    await userEvent.click(removeButtons[0]);
    expect(screen.queryByText('Cleanser A')).toBeNull();
  });

  it('clears the cart with the header button', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([ITEM_A]));
    renderWith(<Cart />);
    await screen.findByText('Cleanser A');
    await userEvent.click(screen.getByRole('button', { name: 'Clear cart' }));
    expect(await screen.findByText('Cart is empty.')).toBeInTheDocument();
  });

  it('shows an error banner when the savings request fails', async () => {
    api.cartSavings.mockRejectedValueOnce(new Error('savings down'));
    localStorage.setItem(STORAGE_KEY, JSON.stringify([ITEM_A]));
    renderWith(<Cart />);
    expect(await screen.findByText('savings down')).toBeInTheDocument();
  });
});
