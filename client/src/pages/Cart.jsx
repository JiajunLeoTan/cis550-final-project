import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import { useCart } from '../context/CartContext.jsx';
import { Empty, ErrorBanner } from '../components/States.jsx';
import { formatCurrency, formatProductPrice, isValidPrice } from '../utils/format.js';

export default function Cart() {
  const { items, remove, clear } = useCart();
  const [savings, setSavings] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const asins = useMemo(() => items.map((i) => i.asin), [items]);

  useEffect(() => {
    if (asins.length === 0) {
      setSavings({
        total_list_price: 0,
        total_current_price: 0,
        total_savings: 0
      });
      return undefined;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    api
      .cartSavings(asins)
      .then((res) => {
        if (!cancelled) setSavings(res);
      })
      .catch((err) => {
        if (!cancelled) setError(err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [asins.join('|')]); // eslint-disable-line react-hooks/exhaustive-deps

  const totalList = savings?.total_list_price ?? 0;
  const totalCurrent = savings?.total_current_price ?? 0;
  const totalSavings = savings?.total_savings ?? 0;
  const pct = totalList > 0 ? (totalSavings / totalList) * 100 : 0;

  return (
    <div className="container">
      <div className="row between" style={{ alignItems: 'baseline', marginBottom: 'var(--s-10)' }}>
        <h1 className="page-title">Cart</h1>
        {items.length > 0 && (
          <button className="text-button" onClick={clear}>
            Clear cart
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <Empty
          title="Cart is empty."
          description="Add a few products to see combined savings."
          action={
            <Link to="/browse" className="btn">
              Start browsing
            </Link>
          }
        />
      ) : (
        <div
          className="grid"
          style={{
            gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr)',
            gap: 'var(--s-8)'
          }}
        >
          <div className="plain-list">
            {items.map((it) => (
              <div
                key={it.asin}
                style={{
                  padding: 'var(--s-4) 0',
                  display: 'grid',
                  gridTemplateColumns: '80px 1fr auto',
                  gap: 'var(--s-4)',
                  alignItems: 'center'
                }}
              >
                <div
                  style={{
                    width: 80,
                    height: 80,
                    borderRadius: 'var(--r)',
                    overflow: 'hidden',
                    background: 'var(--paper-2)',
                    display: 'grid',
                    placeItems: 'center'
                  }}
                >
                  {it.img_url ? (
                    <img
                      src={it.img_url}
                      alt=""
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover'
                      }}
                    />
                  ) : (
                    <span className="meta-line">{it.asin.slice(-4)}</span>
                  )}
                </div>
                <div style={{ minWidth: 0 }}>
                  <Link
                    to={`/product/${encodeURIComponent(it.asin)}`}
                    style={{
                      display: '-webkit-box',
                      overflow: 'hidden',
                      WebkitBoxOrient: 'vertical',
                      WebkitLineClamp: 2
                    }}
                  >
                    {it.title}
                  </Link>
                  <div className="meta-line" style={{ marginTop: 4 }}>
                    {[it.category_name, it.brand_name].filter(Boolean).join(' · ')}
                  </div>
                  <div style={{ marginTop: 6 }}>
                    <span className="price price--sm">{formatProductPrice(it.price)}</span>
                    {isValidPrice(it.price) &&
                      isValidPrice(it.list_price) &&
                      it.list_price > it.price && (
                        <span className="price-strike">
                          {formatCurrency(it.list_price)}
                        </span>
                      )}
                  </div>
                </div>
                <button className="text-button" onClick={() => remove(it.asin)}>
                  Remove
                </button>
              </div>
            ))}
          </div>

          <aside
            className="card"
            style={{
              padding: 'var(--s-6)',
              position: 'sticky',
              top: 88,
              alignSelf: 'start'
            }}
          >
            <div className="row between" style={{ alignItems: 'baseline', marginBottom: 'var(--s-4)' }}>
              <h2 className="card-title">Savings</h2>
              {loading && <span className="meta-line">Updating</span>}
            </div>

            <table className="receipt">
              <tbody>
                <tr>
                  <th scope="row">Subtotal</th>
                  <td>{formatCurrency(totalCurrent)}</td>
                </tr>
                <tr>
                  <th scope="row">List price</th>
                  <td>{formatCurrency(totalList)}</td>
                </tr>
                <tr>
                  <th scope="row">You save</th>
                  <td>
                    {formatCurrency(totalSavings)}{' '}
                    <span className="discount">({pct.toFixed(1)}%)</span>
                  </td>
                </tr>
              </tbody>
            </table>

            {error && (
              <div style={{ marginTop: 12 }}>
                <ErrorBanner error={error} />
              </div>
            )}

            <button className="btn btn--block" style={{ marginTop: 'var(--s-6)' }}>
              Checkout
            </button>
            <div className="meta-line" style={{ marginTop: 10 }}>
              Demo only - no order is placed.
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
