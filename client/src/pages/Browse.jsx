import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
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

export default function Browse() {
  const [params, setParams] = useSearchParams();
  const [keyword, setKeyword] = useState(params.get('q') || '');
  const [minStars, setMinStars] = useState(Number(params.get('minStars')) || 0);
  const [maxPrice, setMaxPrice] = useState(Number(params.get('maxPrice')) || 200);
  const [category, setCategory] = useState(params.get('category') || '');

  const debouncedKeyword = useDebounced(keyword, 400);
  const debouncedMaxPrice = useDebounced(maxPrice, 400);

  const location = useLocation();
  const navigate = useNavigate();

  // Sync URL
  useEffect(() => {
    const next = new URLSearchParams();
    if (debouncedKeyword) next.set('q', debouncedKeyword);
    if (minStars) next.set('minStars', String(minStars));
    if (category) next.set('category', category);
    setParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedKeyword, minStars, category]);

  // Scroll to section from hash
  useEffect(() => {
    if (!location.hash) return;
    const el = document.querySelector(location.hash);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [location.hash]);

  const { data: categories } = useApi((opts) => api.categories(opts), []);

  const searchKey = `${debouncedKeyword}|${minStars}`;
  const {
    data: searchResults,
    loading: searchLoading,
    error: searchError
  } = useApi(
    (opts) =>
      debouncedKeyword
        ? api.searchProducts(
            { keyword: debouncedKeyword, minStars: minStars || undefined },
            opts
          )
        : Promise.resolve([]),
    [searchKey],
    { skip: !debouncedKeyword }
  );

  const { data: deals, loading: dealsLoading, error: dealsError } = useApi(
    (opts) => api.deals({ maxPrice: debouncedMaxPrice }, opts),
    [debouncedMaxPrice]
  );

  const trendingCategory = category || (categories?.[0]?.category_name ?? '');
  const { data: trending, loading: trendingLoading } = useApi(
    (opts) =>
      trendingCategory
        ? api.trending({ category: trendingCategory, months: 60 }, opts)
        : Promise.resolve([]),
    [trendingCategory],
    { skip: !trendingCategory }
  );

  const topDeals = useMemo(() => (deals || []).slice(0, 12), [deals]);
  const topTrending = useMemo(() => (trending || []).slice(0, 12), [trending]);

  return (
    <div className="container stack-lg fade-in">
      <section>
        <div className="section-header">
          <div className="title-block">
            <span className="eyebrow">Search</span>
            <h1 className="h-display h-display--lg">Find exactly what matters.</h1>
          </div>
        </div>

        <div
          className="card"
          style={{
            padding: 'var(--s-6)',
            display: 'grid',
            gap: 'var(--s-5)',
            gridTemplateColumns: '2fr 1fr 1fr',
            alignItems: 'end'
          }}
        >
          <div>
            <label className="label" htmlFor="q">
              Keyword
            </label>
            <input
              id="q"
              className="input"
              placeholder="e.g. noise-cancelling headphones"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="minStars">
              Minimum rating: <span className="text-num">{minStars.toFixed(1)}</span>
            </label>
            <input
              id="minStars"
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
            <label className="label" htmlFor="cat">
              Category (for trending)
            </label>
            <select
              id="cat"
              className="select"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="">Auto-pick</option>
              {(categories || []).map((c) => (
                <option key={c.category_id} value={c.category_name}>
                  {c.category_name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ marginTop: 'var(--s-8)' }}>
          {debouncedKeyword ? (
            <>
              <div
                className="row between"
                style={{ marginBottom: 'var(--s-4)', alignItems: 'baseline' }}
              >
                <div className="muted" style={{ fontSize: 14 }}>
                  {searchLoading
                    ? 'Searching…'
                    : `${(searchResults || []).length} result${
                        (searchResults || []).length === 1 ? '' : 's'
                      } for "${debouncedKeyword}"`}
                </div>
                <button
                  className="btn btn--ghost btn--sm"
                  onClick={() => {
                    setKeyword('');
                    navigate('/browse', { replace: true });
                  }}
                >
                  Clear
                </button>
              </div>
              {searchError && <ErrorBanner error={searchError} />}
              {searchLoading ? (
                <SkeletonGrid count={8} />
              ) : (searchResults || []).length === 0 ? (
                <Empty
                  title="No products match that search."
                  description="Try a shorter keyword or lower the minimum rating."
                />
              ) : (
                <div className="grid grid-4 stagger">
                  {searchResults.map((p) => (
                    <ProductCard key={p.asin} product={p} />
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="muted" style={{ fontSize: 14 }}>
              Type a keyword above to search the catalog.
            </div>
          )}
        </div>
      </section>

      <section id="deals" style={{ scrollMarginTop: 90 }}>
        <div className="section-header">
          <div className="title-block">
            <span className="eyebrow">Deals</span>
            <h2 className="h-display h-display--lg">Discounts, ranked by depth.</h2>
          </div>
          <div style={{ minWidth: 260 }}>
            <label className="label" htmlFor="maxPrice">
              Max price: <span className="text-num">${maxPrice}</span>
            </label>
            <input
              id="maxPrice"
              className="slider"
              type="range"
              min={20}
              max={1000}
              step={10}
              value={maxPrice}
              onChange={(e) => setMaxPrice(Number(e.target.value))}
            />
          </div>
        </div>

        {dealsError && <ErrorBanner error={dealsError} />}
        {dealsLoading ? (
          <SkeletonGrid count={8} />
        ) : topDeals.length === 0 ? (
          <Empty
            title="No active deals in this price range."
            description="Try raising your max price."
          />
        ) : (
          <div className="grid grid-4 stagger">
            {topDeals.map((p) => (
              <ProductCard
                key={p.asin}
                product={p}
                badge={
                  p.discount_pct
                    ? { label: `-${Math.round(p.discount_pct)}%`, tone: 'ember' }
                    : null
                }
              />
            ))}
          </div>
        )}
      </section>

      <section id="trending" style={{ scrollMarginTop: 90 }}>
        <div className="section-header">
          <div className="title-block">
            <span className="eyebrow">Trending</span>
            <h2 className="h-display h-display--lg">
              Catching fire in{' '}
              <span className="muted">{trendingCategory || '—'}</span>
            </h2>
          </div>
        </div>

        {trendingLoading ? (
          <SkeletonGrid count={8} />
        ) : topTrending.length === 0 ? (
          <Empty
            title="Not enough momentum signal yet."
            description="Review data for this category is still sparse. Try a different category."
          />
        ) : (
          <div className="grid grid-4 stagger">
            {topTrending.map((p) => (
              <ProductCard
                key={p.asin}
                product={p}
                badge={
                  p.recent_review_count
                    ? { label: `${p.recent_review_count} recent`, tone: 'emerald' }
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
