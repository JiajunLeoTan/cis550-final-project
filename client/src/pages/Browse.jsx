import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api/client.js';
import { useApi } from '../api/useApi.js';
import ProductCard from '../components/ProductCard.jsx';
import { Empty, ErrorBanner, SkeletonGrid } from '../components/States.jsx';
import { formatCurrency } from '../utils/format.js';

const PRODUCT_PAGE_SIZE = 24;
const CATEGORY_PAGE_SIZE = 8;
const CATEGORY_PREVIEW_LIMIT = 4;

function useDebounced(value, delay = 350) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

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

function useSearchProducts({ keyword, minStars }) {
  const key = `${keyword}|${minStars}`;
  const [activeKey, setActiveKey] = useState(key);
  const [page, setPage] = useState(0);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [hasMore, setHasMore] = useState(Boolean(keyword));
  const loadingRef = useRef(false);

  useEffect(() => {
    setActiveKey(key);
    setPage(0);
    setItems([]);
    setError(null);
    setHasMore(Boolean(keyword));
  }, [key, keyword]);

  useEffect(() => {
    if (!keyword || activeKey !== key) return undefined;
    const controller = new AbortController();
    const offset = page * PRODUCT_PAGE_SIZE;

    async function loadPage() {
      loadingRef.current = true;
      setLoading(true);
      setError(null);
      try {
        const rows = await api.searchProducts(
          {
            keyword,
            minStars: minStars || undefined,
            limit: PRODUCT_PAGE_SIZE,
            offset
          },
          { signal: controller.signal }
        );

        if (controller.signal.aborted) return;
        setItems((prev) => (page === 0 ? rows : appendUnique(prev, rows)));
        setHasMore(rows.length === PRODUCT_PAGE_SIZE);
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
  }, [activeKey, key, keyword, minStars, page]);

  const loadMore = useCallback(() => {
    if (loadingRef.current || loading || !hasMore) return;
    setPage((p) => p + 1);
  }, [hasMore, loading]);

  return { items, loading, error, hasMore, loadMore };
}

export default function Browse() {
  const [params, setParams] = useSearchParams();
  const [keyword, setKeyword] = useState(params.get('q') || '');
  const [minStars, setMinStars] = useState(Number(params.get('minStars')) || 0);
  const [maxPrice, setMaxPrice] = useState(Number(params.get('maxPrice')) || 0);
  const [visibleCategoryCount, setVisibleCategoryCount] = useState(CATEGORY_PAGE_SIZE);
  const sentinelRef = useRef(null);

  const debouncedKeyword = useDebounced(keyword, 400).trim();
  const debouncedMaxPrice = useDebounced(maxPrice, 400);
  const navigate = useNavigate();

  useEffect(() => {
    const next = new URLSearchParams();
    if (debouncedKeyword) next.set('q', debouncedKeyword);
    if (minStars) next.set('minStars', String(minStars));
    if (debouncedMaxPrice) next.set('maxPrice', String(debouncedMaxPrice));
    setParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedKeyword, minStars, debouncedMaxPrice]);

  const { data: categories, loading: categoriesLoading, error: categoriesError } = useApi(
    (opts) => api.categories(opts),
    []
  );

  useEffect(() => {
    setVisibleCategoryCount(CATEGORY_PAGE_SIZE);
  }, [categories?.length, minStars, debouncedMaxPrice]);

  const {
    items: products,
    loading: productsLoading,
    error: productsError,
    hasMore: hasMoreProducts,
    loadMore: loadMoreProducts
  } = useSearchProducts({
    keyword: debouncedKeyword,
    minStars
  });

  const isSearching = Boolean(debouncedKeyword);
  const categoryRows = categories || [];
  const visibleCategories = useMemo(
    () => categoryRows.slice(0, visibleCategoryCount),
    [categoryRows, visibleCategoryCount]
  );
  const hasMoreCategories = visibleCategoryCount < categoryRows.length;

  const loadMoreCategories = useCallback(() => {
    setVisibleCategoryCount((count) =>
      Math.min(count + CATEGORY_PAGE_SIZE, categoryRows.length)
    );
  }, [categoryRows.length]);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node) return undefined;
    if (isSearching && !hasMoreProducts) return undefined;
    if (!isSearching && !hasMoreCategories) return undefined;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        if (isSearching) {
          loadMoreProducts();
        } else {
          loadMoreCategories();
        }
      },
      { rootMargin: '700px 0px' }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMoreCategories, hasMoreProducts, isSearching, loadMoreCategories, loadMoreProducts]);

  const categoriesForStrip = useMemo(() => categoryRows.slice(0, 10), [categoryRows]);

  return (
    <div className="container browse-home">
      <section className="browse-hero">
        <div>
          <h1 className="page-title">Browse</h1>
          <p className="lead">
            Shop by category, with a few products from each section. Search switches
            to a full product feed.
          </p>
        </div>

        <div className="browse-filters">
          <div>
            <label className="label" htmlFor="q">
              Search products
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
              Minimum rating <span className="filter-value">{minStars.toFixed(1)}</span>
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
            <label className="label" htmlFor="maxPrice">
              Category preview max price{' '}
              <span className="filter-value">{maxPrice ? `$${maxPrice}` : 'Any'}</span>
            </label>
            <input
              id="maxPrice"
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

        {categoriesForStrip.length > 0 && (
          <div className="category-strip" aria-label="Browse by category">
            {categoriesForStrip.map((c) => (
              <Link
                key={c.category_id}
                className="category-chip"
                to={`/category/${encodeURIComponent(c.category_name)}`}
              >
                {c.category_name}
              </Link>
            ))}
          </div>
        )}
      </section>

      {isSearching ? (
        <section>
          <header className="section-header">
            <h2 className="section-title">Search results</h2>
            <div className="section-actions">
              <span className="meta-line">
                Showing {products.length} result{products.length === 1 ? '' : 's'}
              </span>
              <button
                className="text-button"
                onClick={() => {
                  setKeyword('');
                  navigate('/browse', { replace: true });
                }}
              >
                Clear search
              </button>
            </div>
          </header>
          {productsError && <ErrorBanner error={productsError} />}
          {productsLoading && products.length === 0 ? (
            <SkeletonGrid count={8} />
          ) : products.length === 0 ? (
            <Empty
              title="No products match that search."
              description="Try a shorter keyword or lower the minimum rating."
            />
          ) : (
            <ProductFeed products={products} />
          )}
        </section>
      ) : (
        <section>
          <header className="section-header">
            <h2 className="section-title">Shop by category</h2>
            <div className="section-actions">
              <span className="meta-line">
                Showing {visibleCategories.length} of {categoryRows.length}
              </span>
            </div>
          </header>

          {categoriesError && <ErrorBanner error={categoriesError} />}
          {categoriesLoading && visibleCategories.length === 0 ? (
            <CategoryCardSkeletonGrid />
          ) : visibleCategories.length === 0 ? (
            <Empty title="No categories available." />
          ) : (
            <div className="category-card-grid">
              {visibleCategories.map((c) => (
                <CategoryCard
                  key={c.category_id}
                  category={c}
                  minStars={minStars}
                  maxPrice={debouncedMaxPrice}
                />
              ))}
            </div>
          )}
        </section>
      )}

      <div ref={sentinelRef} className="infinite-sentinel" aria-live="polite">
        {isSearching
          ? productsLoading && products.length > 0
            ? 'Loading more products'
            : hasMoreProducts
              ? 'Scroll for more products'
              : products.length > 0
                ? 'End of product results'
                : ''
          : hasMoreCategories
            ? 'Scroll for more categories'
            : categoryRows.length > 0
              ? 'End of categories'
              : ''}
      </div>
    </div>
  );
}

function CategoryCard({ category, minStars, maxPrice }) {
  const categoryName = category.category_name;
  const { data, loading, error } = useApi(
    (opts) =>
      api.categoryProducts(
        {
          category: categoryName,
          minStars: minStars || undefined,
          maxPrice: maxPrice || undefined,
          limit: CATEGORY_PREVIEW_LIMIT,
          offset: 0
        },
        opts
      ),
    [categoryName, minStars, maxPrice]
  );

  const products = data || [];

  return (
    <article className="card card-hover category-card">
      <Link
        to={`/category/${encodeURIComponent(categoryName)}`}
        className="category-card-title"
      >
        {categoryName}
      </Link>

      {error && <div className="meta-line">Could not load products.</div>}
      {loading ? (
        <div className="category-preview-grid">
          {Array.from({ length: CATEGORY_PREVIEW_LIMIT }).map((_, i) => (
            <div key={i} className="skeleton" style={{ aspectRatio: '1 / 1' }} />
          ))}
        </div>
      ) : products.length === 0 ? (
        <div className="category-card-empty">No products match these filters.</div>
      ) : (
        <div className="category-preview-grid">
          {products.map((p) => (
            <Link
              key={p.asin}
              className="category-preview"
              to={`/product/${encodeURIComponent(p.asin)}`}
            >
              <div className="category-preview-media">
                {p.img_url ? (
                  <img src={p.img_url} alt="" loading="lazy" />
                ) : (
                  <span>{p.asin.slice(-4)}</span>
                )}
              </div>
              <div className="category-preview-title">{p.title || 'Untitled product'}</div>
              <div className="category-preview-price">{formatCurrency(p.price)}</div>
            </Link>
          ))}
        </div>
      )}

      <Link
        to={`/category/${encodeURIComponent(categoryName)}`}
        className="text-link"
        style={{ marginTop: 'auto' }}
      >
        See all
      </Link>
    </article>
  );
}

function ProductFeed({ products }) {
  if (!products.length) return null;
  return (
    <div className="browse-product-grid">
      {products.map((p) => (
        <ProductCard
          key={p.asin}
          product={p}
          badge={
            p.discount_pct
              ? { label: `${Math.round(p.discount_pct)}% off`, tone: 'positive' }
              : p.recent_review_count
                ? { label: `${p.recent_review_count} recent` }
                : null
          }
        />
      ))}
    </div>
  );
}

function CategoryCardSkeletonGrid() {
  return (
    <div className="category-card-grid">
      {Array.from({ length: CATEGORY_PAGE_SIZE }).map((_, i) => (
        <div key={i} className="card category-card">
          <div className="skeleton" style={{ height: 26, width: '70%' }} />
          <div className="category-preview-grid">
            {Array.from({ length: CATEGORY_PREVIEW_LIMIT }).map((__, j) => (
              <div key={j} className="skeleton" style={{ aspectRatio: '1 / 1' }} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
