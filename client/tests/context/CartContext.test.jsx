import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { CartProvider, useCart } from '../../src/context/CartContext.jsx';

const STORAGE_KEY = 'axiom.cart.v1';

function wrapper({ children }) {
  return <CartProvider>{children}</CartProvider>;
}

const PRODUCT_A = {
  asin: 'B0000A',
  title: 'A',
  price: 10,
  list_price: 12,
  img_url: 'https://x/a.jpg',
  stars: 4.4,
  category_name: 'Beauty',
  brand_name: 'Acme'
};
const PRODUCT_B = { asin: 'B0000B', title: 'B' };

describe('CartContext', () => {
  it('starts empty when storage is empty', () => {
    const { result } = renderHook(() => useCart(), { wrapper });
    expect(result.current.items).toEqual([]);
    expect(result.current.count).toBe(0);
  });

  it('hydrates from localStorage on mount', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([PRODUCT_A]));
    const { result } = renderHook(() => useCart(), { wrapper });
    expect(result.current.items).toEqual([PRODUCT_A]);
  });

  it('falls back to empty when stored value is invalid JSON', () => {
    localStorage.setItem(STORAGE_KEY, 'not json');
    const { result } = renderHook(() => useCart(), { wrapper });
    expect(result.current.items).toEqual([]);
  });

  it('falls back to empty when stored value is not an array', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ asin: 'B' }));
    const { result } = renderHook(() => useCart(), { wrapper });
    expect(result.current.items).toEqual([]);
  });

  it('add appends a product and persists to storage', () => {
    const { result } = renderHook(() => useCart(), { wrapper });
    act(() => result.current.add(PRODUCT_A));
    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0]).toMatchObject({
      asin: PRODUCT_A.asin,
      title: PRODUCT_A.title,
      price: 10
    });
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    expect(stored).toHaveLength(1);
    expect(stored[0].asin).toBe(PRODUCT_A.asin);
  });

  it('add normalizes nullable fields when missing', () => {
    const { result } = renderHook(() => useCart(), { wrapper });
    act(() => result.current.add({ asin: 'B0000Z', title: 'Z' }));
    expect(result.current.items[0]).toMatchObject({
      asin: 'B0000Z',
      title: 'Z',
      price: null,
      list_price: null,
      img_url: null,
      stars: null,
      category_name: null,
      brand_name: null
    });
  });

  it('add ignores products without an asin', () => {
    const { result } = renderHook(() => useCart(), { wrapper });
    act(() => result.current.add({}));
    act(() => result.current.add(null));
    expect(result.current.items).toEqual([]);
  });

  it('add deduplicates by asin', () => {
    const { result } = renderHook(() => useCart(), { wrapper });
    act(() => result.current.add(PRODUCT_A));
    act(() => result.current.add(PRODUCT_A));
    expect(result.current.items).toHaveLength(1);
  });

  it('remove drops an item by asin', () => {
    const { result } = renderHook(() => useCart(), { wrapper });
    act(() => {
      result.current.add(PRODUCT_A);
      result.current.add(PRODUCT_B);
    });
    act(() => result.current.remove(PRODUCT_A.asin));
    expect(result.current.items.map((p) => p.asin)).toEqual([PRODUCT_B.asin]);
  });

  it('toggle adds when missing and removes when present', () => {
    const { result } = renderHook(() => useCart(), { wrapper });
    act(() => result.current.toggle(PRODUCT_A));
    expect(result.current.has(PRODUCT_A.asin)).toBe(true);

    act(() => result.current.toggle(PRODUCT_A));
    expect(result.current.has(PRODUCT_A.asin)).toBe(false);
  });

  it('toggle ignores products without an asin', () => {
    const { result } = renderHook(() => useCart(), { wrapper });
    act(() => result.current.toggle({}));
    expect(result.current.items).toEqual([]);
  });

  it('clear empties the cart', () => {
    const { result } = renderHook(() => useCart(), { wrapper });
    act(() => {
      result.current.add(PRODUCT_A);
      result.current.add(PRODUCT_B);
    });
    act(() => result.current.clear());
    expect(result.current.items).toEqual([]);
    expect(result.current.count).toBe(0);
  });

  it('useCart throws when used outside the provider', () => {
    const orig = console.error;
    console.error = () => {};
    try {
      expect(() => renderHook(() => useCart())).toThrow(
        /useCart must be used inside CartProvider/
      );
    } finally {
      console.error = orig;
    }
  });
});
