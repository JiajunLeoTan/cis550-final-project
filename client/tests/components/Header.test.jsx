import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import Header from '../../src/components/Header.jsx';
import { renderWith } from '../test-utils.jsx';

const STORAGE_KEY = 'axiom.cart.v1';

describe('Header', () => {
  it('renders the brand and primary nav links', () => {
    renderWith(<Header />);
    expect(screen.getByLabelText('Axiom home')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Browse' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Analytics' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Value rankings' })).toBeInTheDocument();
  });

  it('shows just "Cart" with no count when the cart is empty', () => {
    renderWith(<Header />);
    const cartLink = screen.getByRole('link', { name: /Cart with 0 items/i });
    expect(cartLink).toBeInTheDocument();
    expect(cartLink.textContent).toBe('Cart');
  });

  it('shows a count badge when the cart has items', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([{ asin: 'B000A' }, { asin: 'B000B' }])
    );
    renderWith(<Header />);
    const cartLink = screen.getByRole('link', { name: /Cart with 2 items/i });
    expect(cartLink).toBeInTheDocument();
    expect(cartLink.textContent).toContain('2');
  });
});
