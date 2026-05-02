import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';
import { useApi } from '../api/useApi.js';
import ProductCard from '../components/ProductCard.jsx';
import { SkeletonGrid } from '../components/States.jsx';

export default function Home() {
  const [q, setQ] = useState('');
  const navigate = useNavigate();

  const { data: proven, loading: provenLoading } = useApi(
    (opts) => api.trending({ category: 'Makeup', months: 120 }, opts),
    []
  );
  const { data: deals, loading: dealsLoading } = useApi(
    (opts) => api.deals({ maxPrice: 120 }, opts),
    []
  );

  const submit = (e) => {
    e.preventDefault();
    const keyword = q.trim();
    if (!keyword) return;
    navigate(`/browse?q=${encodeURIComponent(keyword)}`);
  };

  const featured = (deals || []).slice(0, 4);
  const provenPicks = (proven || []).slice(0, 4);

  return (
    <>
      <section className="container" style={{ paddingTop: 'var(--s-8)' }}>
        <div style={{ maxWidth: 820 }}>
          <h1 className="page-title">A reading room for 1.4 million products.</h1>
          <p className="lead">
            Search the catalog, compare categories, and rank products by the weights
            you care about: rating, review depth, price, and recent activity.
          </p>

          <form
            onSubmit={submit}
            className="row gap-2"
            style={{ marginTop: 'var(--s-8)', maxWidth: 640 }}
          >
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search products by keyword"
              className="input"
              style={{ fontSize: 17 }}
              aria-label="Search products"
            />
            <button className="btn" type="submit">
              Search
            </button>
          </form>
        </div>
      </section>

      <section className="container section">
        <div className="inline-prose">
          <p>
            Start with <Link to="/browse">Browse</Link> to search by keyword and
            rating, or jump straight to <Link to="/browse#deals">deals</Link>.
            <Link to="/analytics"> Analytics</Link> shows how categories and brands
            compare across the corpus.
          </p>
          <p>
            <Link to="/value">Value rankings</Link> lets you weight what good means
            and re-rank the catalog live. The <Link to="/cart">cart</Link> keeps a
            simple receipt of current price, list price, and savings.
          </p>
        </div>
      </section>

      <section className="container section">
        <h2 className="section-title">Proven picks</h2>
        {provenLoading ? (
          <SkeletonGrid count={4} />
        ) : provenPicks.length === 0 ? (
          <div className="card card-body muted">
            Not enough review coverage yet to surface proven picks.
          </div>
        ) : (
          <>
            <div className="grid grid-4">
              {provenPicks.map((p) => (
                <ProductCard key={p.asin} product={p} badge={{ label: 'Proven' }} />
              ))}
            </div>
            <div style={{ marginTop: 'var(--s-4)' }}>
              <Link to="/value" className="text-link">
                More rankings
              </Link>
            </div>
          </>
        )}
      </section>

      <section className="container section">
        <h2 className="section-title">Under $120</h2>
        {dealsLoading ? (
          <SkeletonGrid count={4} />
        ) : featured.length === 0 ? (
          <div className="card card-body muted">No deals available right now.</div>
        ) : (
          <>
            <div className="grid grid-4">
              {featured.map((p) => (
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
            <div style={{ marginTop: 'var(--s-4)' }}>
              <Link to="/browse#deals" className="text-link">
                More deals
              </Link>
            </div>
          </>
        )}
      </section>
    </>
  );
}
