import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import { useCart } from '../context/CartContext.jsx';
import AnimatedNumber from '../components/AnimatedNumber.jsx';
import { Empty, ErrorBanner } from '../components/States.jsx';
import { formatCurrency } from '../utils/format.js';

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
  const pct =
    totalList > 0 ? Math.max(0, Math.min(100, (totalSavings / totalList) * 100)) : 0;

  return (
    <div className="container fade-in">
      <div className="section-header">
        <div className="title-block">
          <span className="eyebrow">Your cart</span>
          <h1 className="h-display h-display--lg">Ready when you are.</h1>
        </div>
        {items.length > 0 && (
          <button className="btn btn--ghost btn--sm" onClick={clear}>
            Clear cart
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <Empty
          title="Cart is empty."
          description="Add a few products to see combined savings."
          action={
            <Link to="/browse" className="btn btn--emerald">
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
          <div className="stack">
            {items.map((it) => (
              <div
                key={it.asin}
                className="card"
                style={{
                  padding: 'var(--s-4)',
                  display: 'grid',
                  gridTemplateColumns: '96px 1fr auto',
                  gap: 'var(--s-4)',
                  alignItems: 'center'
                }}
              >
                <div
                  style={{
                    width: 96,
                    height: 96,
                    borderRadius: 'var(--r-md)',
                    overflow: 'hidden',
                    background:
                      'linear-gradient(140deg, var(--ivory-200), var(--ivory-100))',
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
                    <span
                      className="muted"
                      style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}
                    >
                      {it.asin.slice(-4)}
                    </span>
                  )}
                </div>
                <div style={{ minWidth: 0 }}>
                  <Link
                    to={`/product/${encodeURIComponent(it.asin)}`}
                    style={{
                      fontWeight: 600,
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden'
                    }}
                  >
                    {it.title}
                  </Link>
                  <div className="row gap-2 muted" style={{ fontSize: 13, marginTop: 4 }}>
                    {it.category_name && <span>{it.category_name}</span>}
                    {it.brand_name && <span>· {it.brand_name}</span>}
                  </div>
                  <div className="row gap-2" style={{ marginTop: 6, alignItems: 'baseline' }}>
                    <span className="price price--sm">{formatCurrency(it.price)}</span>
                    {it.list_price != null &&
                      it.price != null &&
                      it.list_price > it.price && (
                        <span className="price-strike">
                          {formatCurrency(it.list_price)}
                        </span>
                      )}
                  </div>
                </div>
                <button
                  className="btn btn--ghost btn--sm"
                  onClick={() => remove(it.asin)}
                >
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
              alignSelf: 'start',
              background:
                'linear-gradient(160deg, var(--surface) 0%, var(--ivory-50) 100%)'
            }}
          >
            <span className="eyebrow">Savings</span>
            <h2 className="h-display h-display--lg" style={{ marginTop: 8 }}>
              <AnimatedNumber
                value={totalSavings}
                format={(n) => formatCurrency(n)}
                duration={800}
              />
            </h2>
            <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
              vs. list price across {items.length} item{items.length === 1 ? '' : 's'}
            </div>

            <div
              style={{
                marginTop: 'var(--s-6)',
                height: 8,
                background: 'var(--ivory-200)',
                borderRadius: 'var(--r-full)',
                overflow: 'hidden'
              }}
              role="progressbar"
              aria-valuenow={Math.round(pct)}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div
                style={{
                  width: `${pct}%`,
                  height: '100%',
                  background:
                    'linear-gradient(90deg, var(--emerald-500), var(--gold-500))',
                  transition: 'width 720ms var(--ease-out)'
                }}
              />
            </div>
            <div
              className="row between muted"
              style={{ marginTop: 6, fontSize: 12, fontFamily: 'var(--font-mono)' }}
            >
              <span>
                <AnimatedNumber value={pct} format={(n) => `${n.toFixed(1)}%`} duration={700} />{' '}
                off list
              </span>
              <span>Goal: maximum</span>
            </div>

            <div
              className="stack"
              style={{
                marginTop: 'var(--s-6)',
                paddingTop: 'var(--s-5)',
                borderTop: '1px solid var(--line)',
                gap: 10
              }}
            >
              <div className="row between">
                <span className="muted">List total</span>
                <span className="text-num">
                  <AnimatedNumber value={totalList} format={formatCurrency} duration={700} />
                </span>
              </div>
              <div className="row between">
                <span className="muted">Current total</span>
                <span className="text-num" style={{ fontWeight: 600 }}>
                  <AnimatedNumber value={totalCurrent} format={formatCurrency} duration={700} />
                </span>
              </div>
            </div>

            {loading && (
              <div className="muted" style={{ marginTop: 12, fontSize: 12 }}>
                Recalculating…
              </div>
            )}
            {error && <div style={{ marginTop: 12 }}><ErrorBanner error={error} /></div>}

            <button className="btn btn--emerald btn--block" style={{ marginTop: 'var(--s-6)' }}>
              Checkout (demo)
            </button>
          </aside>
        </div>
      )}
    </div>
  );
}
