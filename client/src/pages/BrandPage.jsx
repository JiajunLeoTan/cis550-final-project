import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { api } from '../api/client.js';
import ProductCard from '../components/ProductCard.jsx';
import { Empty, ErrorBanner, SkeletonGrid } from '../components/States.jsx';

const PAGE_SIZE = 24;

function appendUnique(prev, rows) {
  const seen = new Set(prev.map((p) => p.asin));
  const next = [...prev];
  rows.forEach((p) => {
    if (!p?.asin || seen.has(p.asin)) return;
    seen.add(p.asin);
    next.push(p);
  });
  return next;
}

function useDebounced(value, delay = 350) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

function useBrandProducts({ brand, minStars, maxPrice }) {
  const key = `${brand}|${minStars}|${maxPrice || ''}`;
  const [activeKey, setActiveKey] = useState(key);
  const [page, setPage] = useState(0);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const loadingRef = useRef(false);

  useEffect(() => {
    setActiveKey(key);
    setPage(0);
    setItems([]);
    setError(null);
    setHasMore(Boolean(brand));
  }, [brand, key]);

  useEffect(() => {
    if (!brand || activeKey !== key) return undefined;
    const controller = new AbortController();
    const offset = page * PAGE_SIZE;

    async function loadPage() {
      loadingRef.current = true;
      setLoading(true);
      setError(null);
      try {
        const rows = await api.brandProducts(
          {
            brand,
            minStars: minStars || undefined,
            maxPrice: maxPrice || undefined,
            limit: PAGE_SIZE,
            offset
          },
          { signal: controller.signal }
        );

        if (controller.signal.aborted) return;
        setItems((prev) => (page === 0 ? rows : appendUnique(prev, rows)));
        setHasMore(rows.length === PAGE_SIZE);
      } catch (err) {
        if (err.name !== 'AbortError') setError(err);
      } finally {
        if (!controller.signal.aborted) {
          loadingRef.current = false;
          setLoading(false);
        }
      }
    }

    loadPage();
    return () => {
      loadingRef.current = false;
      controller.abort();
    };
  }, [activeKey, brand, key, maxPrice, minStars, page]);

  const loadMore = useCallback(() => {
    if (loadingRef.current || loading || !hasMore) return;
    setPage((p) => p + 1);
  }, [hasMore, loading]);

  return { items, loading, error, hasMore, loadMore };
}

export default function BrandPage() {
  const { brandName } = useParams();
  const brand = brandName || '';
  const [params, setParams] = useSearchParams();
  const [minStars, setMinStars] = useState(Number(params.get('minStars')) || 0);
  const [maxPrice, setMaxPrice] = useState(Number(params.get('maxPrice')) || 0);
  const debouncedMaxPrice = useDebounced(maxPrice, 350);
  const sentinelRef = useRef(null);

  const {
    items,
    loading,
    error,
    hasMore,
    loadMore
  } = useBrandProducts({
    brand,
    minStars,
    maxPrice: debouncedMaxPrice
  });

  useEffect(() => {
    const next = new URLSearchParams();
    if (minStars) next.set('minStars', String(minStars));
    if (debouncedMaxPrice) next.set('maxPrice', String(debouncedMaxPrice));
    setParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [minStars, debouncedMaxPrice]);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !hasMore) return undefined;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) loadMore();
      },
      { rootMargin: '700px 0px' }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, loadMore]);

  const displayName = items[0]?.brand_name || brand;

  return (
    <div className="container browse-home">
      <section className="browse-hero">
        <div className="meta-line" style={{ marginBottom: 'var(--s-3)' }}>
          <Link to="/analytics">Analytics</Link> / Brand
        </div>
        <h1 className="page-title">{displayName}</h1>
        <p className="lead">
          Products from this brand, sorted by rating and review depth. Keep scrolling
          to load the next page from the server.
        </p>

        <div className="browse-filters" style={{ gridTemplateColumns: 'repeat(2, minmax(180px, 1fr))' }}>
          <div>
            <label className="label" htmlFor="brandMinStars">
              Minimum rating <span className="filter-value">{minStars.toFixed(1)}</span>
            </label>
            <input
              id="brandMinStars"
              className="slider"
              type="range"
              min={0}
              max={5}
              step={0.5}
              value={minStars}
              onChange={(e) => setMinStars(Number(e.target.value))}
            />
          </div>
          <div>
            <label className="label" htmlFor="brandMaxPrice">
              Max price{' '}
              <span className="filter-value">
                {maxPrice ? `$${maxPrice}` : 'Any'}
              </span>
            </label>
            <input
              id="brandMaxPrice"
              className="slider"
              type="range"
              min={0}
              max={1000}
              step={10}
              value={maxPrice}
              onChange={(e) => setMaxPrice(Number(e.target.value))}
            />
          </div>
        </div>
      </section>

      <section>
        <header className="section-header">
          <h2 className="section-title">Products</h2>
          <div className="section-actions">
            <span className="meta-line">Showing {items.length} loaded</span>
          </div>
        </header>

        {error && <ErrorBanner error={error} />}
        {loading && items.length === 0 ? (
          <SkeletonGrid count={8} />
        ) : items.length === 0 ? (
          <Empty
            title="No products found for this brand."
            description="Try lowering the rating filter or clearing the max price."
          />
        ) : (
          <div className="browse-product-grid">
            {items.map((p) => (
              <ProductCard
                key={p.asin}
                product={p}
                badge={
                  p.discount_pct
                    ? { label: `${Math.round(p.discount_pct)}% off`, tone: 'positive' }
                    : null
                }
              />
            ))}
          </div>
        )}
      </section>

      <div ref={sentinelRef} className="infinite-sentinel" aria-live="polite">
        {loading && items.length > 0
          ? 'Loading more products'
          : hasMore
            ? 'Scroll for more'
            : items.length > 0
              ? 'End of available products'
              : ''}
      </div>
    </div>
  );
}
