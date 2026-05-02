import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { api } from '../api/client.js';
import { useApi } from '../api/useApi.js';
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

function useCategoryProducts({ category, minStars, maxPrice }) {
  const key = `${category}|${minStars}|${maxPrice || ''}`;
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
    setHasMore(Boolean(category));
  }, [category, key]);

  useEffect(() => {
    if (!category || activeKey !== key) return undefined;
    const controller = new AbortController();
    const offset = page * PAGE_SIZE;

    async function loadPage() {
      loadingRef.current = true;
      setLoading(true);
      setError(null);
      try {
        const rows = await api.categoryProducts(
          {
            category,
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
  }, [activeKey, category, key, maxPrice, minStars, page]);

  const loadMore = useCallback(() => {
    if (loadingRef.current || loading || !hasMore) return;
    setPage((p) => p + 1);
  }, [hasMore, loading]);

  return { items, loading, error, hasMore, loadMore };
}

export default function CategoryPage() {
  const { categoryName } = useParams();
  const category = categoryName || '';
  const [params, setParams] = useSearchParams();
  const [minStars, setMinStars] = useState(Number(params.get('minStars')) || 0);
  const [maxPrice, setMaxPrice] = useState(Number(params.get('maxPrice')) || 0);
  const debouncedMaxPrice = useDebounced(maxPrice, 350);
  const sentinelRef = useRef(null);

  const { data: categories } = useApi((opts) => api.categories(opts), []);
  const {
    items,
    loading,
    error,
    hasMore,
    loadMore
  } = useCategoryProducts({
    category,
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

  const categoryLinks = useMemo(() => (categories || []).slice(0, 10), [categories]);
  const displayName = items[0]?.category_name || category;

  return (
    <div className="container browse-home">
      <section className="browse-hero">
        <div className="meta-line" style={{ marginBottom: 'var(--s-3)' }}>
          <Link to="/browse">Browse</Link> / Category
        </div>
        <h1 className="page-title">{displayName}</h1>
        <p className="lead">
          Products in this category, sorted by rating and review depth. Keep scrolling
          to load the next page from the server.
        </p>

        <div className="browse-filters" style={{ gridTemplateColumns: 'repeat(2, minmax(180px, 1fr))' }}>
          <div>
            <label className="label" htmlFor="categoryMinStars">
              Minimum rating <span className="filter-value">{minStars.toFixed(1)}</span>
            </label>
            <input
              id="categoryMinStars"
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
            <label className="label" htmlFor="categoryMaxPrice">
              Max price{' '}
              <span className="filter-value">
                {maxPrice ? `$${maxPrice}` : 'Any'}
              </span>
            </label>
            <input
              id="categoryMaxPrice"
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

        {categoryLinks.length > 0 && (
          <div className="category-strip" aria-label="Other categories">
            {categoryLinks.map((c) => (
              <Link
                key={c.category_id}
                className={`category-chip${c.category_name === category ? ' active' : ''}`}
                to={`/category/${encodeURIComponent(c.category_name)}`}
              >
                {c.category_name}
              </Link>
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="row between" style={{ alignItems: 'baseline', marginBottom: 'var(--s-5)' }}>
          <h2 className="section-title" style={{ margin: 0 }}>
            Products
          </h2>
          <span className="meta-line">
            Showing {items.length} loaded
          </span>
        </div>

        {error && <ErrorBanner error={error} />}
        {loading && items.length === 0 ? (
          <SkeletonGrid count={8} />
        ) : items.length === 0 ? (
          <Empty
            title="No products found for this category."
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
