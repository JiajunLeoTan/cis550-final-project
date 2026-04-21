import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const CartContext = createContext(null);
const STORAGE_KEY = 'axiom.cart.v1';

export function CartProvider({ children }) {
  const [items, setItems] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      /* ignore */
    }
  }, [items]);

  const add = useCallback((product) => {
    if (!product?.asin) return;
    setItems((prev) =>
      prev.some((p) => p.asin === product.asin)
        ? prev
        : [
            ...prev,
            {
              asin: product.asin,
              title: product.title,
              price: product.price ?? null,
              list_price: product.list_price ?? null,
              img_url: product.img_url ?? null,
              stars: product.stars ?? null,
              category_name: product.category_name ?? null,
              brand_name: product.brand_name ?? null
            }
          ]
    );
  }, []);

  const remove = useCallback((asin) => {
    setItems((prev) => prev.filter((p) => p.asin !== asin));
  }, []);

  const toggle = useCallback((product) => {
    if (!product?.asin) return;
    setItems((prev) =>
      prev.some((p) => p.asin === product.asin)
        ? prev.filter((p) => p.asin !== product.asin)
        : [...prev, product]
    );
  }, []);

  const has = useCallback((asin) => items.some((p) => p.asin === asin), [items]);

  const clear = useCallback(() => setItems([]), []);

  const value = useMemo(
    () => ({ items, add, remove, toggle, has, clear, count: items.length }),
    [items, add, remove, toggle, has, clear]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used inside CartProvider');
  return ctx;
}
