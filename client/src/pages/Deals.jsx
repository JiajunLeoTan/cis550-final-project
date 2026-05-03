import { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import { useApi } from '../api/useApi.js';
import ProductCard from '../components/ProductCard.jsx';
import { Empty, ErrorBanner, SkeletonGrid } from '../components/States.jsx';

function useDebounced(value, delay = 350) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

export default function Deals() {
  const [maxPrice, setMaxPrice] = useState(250);
  const [minStars, setMinStars] = useState(0);
  const debouncedMaxPrice = useDebounced(maxPrice);
  const debouncedMinStars = useDebounced(minStars);

  const { data, loading, error } = useApi(
    (opts) =>
      api.deals(
        { maxPrice: debouncedMaxPrice, minStars: debouncedMinStars || undefined },
        opts
      ),
    [debouncedMaxPrice, debouncedMinStars]
  );

  const deals = data || [];

  return (
    <div className="container">
      <section style={{ paddingTop: 'var(--s-8)' }}>
        <div style={{ maxWidth: 820 }}>
          <span className="kicker">On sale &middot; ranked by discount</span>
          <h1 className="page-title">Deals.</h1>
          <p className="lead">
            Products currently priced below their list price, ranked by percentage
            off. Adjust the price ceiling and minimum rating to filter.
          </p>
        </div>

        <div className="browse-filters" style={{ gridTemplateColumns: 'minmax(180px, 1fr) minmax(180px, 1fr)' }}>
          <div>
            <label className="label" htmlFor="dealsMaxPrice">
              Max price{' '}
              <span className="filter-value">${maxPrice}</span>
            </label>
            <input
              id="dealsMaxPrice"
              className="slider"
              type="range"
              min={20}
              max={1000}
              step={10}
              value={maxPrice}
              onChange={(e) => setMaxPrice(Number(e.target.value))}
            />
          </div>
          <div>
            <label className="label" htmlFor="dealsMinStars">
              Minimum rating{' '}
              <span className="filter-value">{minStars.toFixed(1)}</span>
            </label>
            <input
              id="dealsMinStars"
              className="slider"
              type="range"
              min={0}
              max={5}
              step={0.5}
              value={minStars}
              onChange={(e) => setMinStars(Number(e.target.value))}
            />
          </div>
        </div>
      </section>

      <section className="section">
        <header className="section-header">
          <h2 className="section-title">All deals</h2>
          <div className="section-actions">
            <span className="meta-line">
              {loading && deals.length === 0
                ? 'Loading'
                : `${deals.length} found`}
            </span>
          </div>
        </header>

        {error && <ErrorBanner error={error} />}
        {loading && deals.length === 0 ? (
          <SkeletonGrid count={8} />
        ) : deals.length === 0 ? (
          <Empty
            title="No deals match those filters."
            description="Try raising the max price or lowering the minimum rating."
          />
        ) : (
          <div className="grid grid-4">
            {deals.map((p) => (
              <ProductCard
                key={p.asin}
                product={p}
                badge={
                  p.discount_pct
                    ? {
                        label: `${Math.round(p.discount_pct)}% off`,
                        tone: 'positive'
                      }
                    : null
                }
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
