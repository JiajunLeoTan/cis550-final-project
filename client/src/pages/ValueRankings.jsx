import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import { useApi } from '../api/useApi.js';
import Rating from '../components/Rating.jsx';
import { Empty, ErrorBanner } from '../components/States.jsx';
import { formatProductPrice } from '../utils/format.js';

const PRESETS = [
  { name: 'Balanced', w: { wRating: 0.4, wReviews: 0.2, wPriceEff: 0.2, wRecent: 0.2 } },
  { name: 'Quality first', w: { wRating: 0.5, wReviews: 0.3, wPriceEff: 0.1, wRecent: 0.1 } },
  { name: 'Price first', w: { wRating: 0.2, wReviews: 0.15, wPriceEff: 0.55, wRecent: 0.1 } },
  { name: 'Recent activity', w: { wRating: 0.15, wReviews: 0.2, wPriceEff: 0.1, wRecent: 0.55 } }
];

const WEIGHT_META = [
  { key: 'wRating', label: 'Rating strength', description: 'Weight on 1-5 star score.' },
  { key: 'wReviews', label: 'Review depth', description: 'Weight on total review volume.' },
  { key: 'wPriceEff', label: 'Price efficiency', description: 'Weight on cheapness within category.' },
  {
    key: 'wRecent',
    label: 'Recent activity',
    description: 'Weight on reviews in the latest 12-month dataset window.'
  }
];

function useDebounced(value, delay = 400) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

export default function ValueRankings() {
  const [weights, setWeights] = useState(PRESETS[0].w);
  const debounced = useDebounced(weights, 350);

  const keyed = `${debounced.wRating}|${debounced.wReviews}|${debounced.wPriceEff}|${debounced.wRecent}`;
  const { data, loading, error } = useApi(
    (opts) => api.valueRankings(debounced, opts),
    [keyed]
  );

  const rows = useMemo(() => (data || []).slice(0, 25), [data]);
  const top = rows[0];

  const applyPreset = (preset) => setWeights(preset.w);

  return (
    <div className="container stack-lg">
      <header>
        <h1 className="page-title">Value rankings</h1>
        <p className="lead">
          We normalize each dimension to 0-1 per product, scale by your weights, and
          re-rank the whole catalog.
        </p>
      </header>

      <section
        className="grid"
        style={{
          gridTemplateColumns: 'minmax(280px, 360px) minmax(0, 1fr)',
          gap: 'var(--s-8)',
          alignItems: 'start'
        }}
      >
        <aside
          className="card"
          style={{
            padding: 'var(--s-6)',
            position: 'sticky',
            top: 88
          }}
        >
          <h2 className="small-heading">Presets</h2>
          <div className="row row-wrap gap-2" style={{ marginTop: 12, marginBottom: 24 }}>
            {PRESETS.map((p) => (
              <button
                key={p.name}
                className="btn btn--quiet btn--sm"
                onClick={() => applyPreset(p)}
              >
                {p.name}
              </button>
            ))}
          </div>

          <div className="stack">
            {WEIGHT_META.map((m) => (
              <div key={m.key}>
                <div className="row between" style={{ marginBottom: 6 }}>
                  <label className="label" htmlFor={m.key} style={{ margin: 0 }}>
                    {m.label}
                  </label>
                  <span className="filter-value">{weights[m.key].toFixed(2)}</span>
                </div>
                <input
                  id={m.key}
                  className="slider"
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={weights[m.key]}
                  onChange={(e) =>
                    setWeights((w) => ({ ...w, [m.key]: Number(e.target.value) }))
                  }
                />
                <div className="meta-line" style={{ marginTop: 4 }}>
                  {m.description}
                </div>
              </div>
            ))}
          </div>
        </aside>

        <div className="stack-lg">
          <div className="card">
            <div className="card-body">
              <h2 className="card-title">Top result</h2>
              {loading && !top ? (
                <div className="skeleton" style={{ height: 120, marginTop: 12 }} />
              ) : error ? (
                <ErrorBanner error={error} />
              ) : !top ? (
                <div className="muted" style={{ marginTop: 8 }}>
                  No products matched.
                </div>
              ) : (
                <div className="row gap-6" style={{ marginTop: 16, alignItems: 'center' }}>
                  <div
                    style={{
                      width: 120,
                      height: 120,
                      borderRadius: 'var(--r-lg)',
                      overflow: 'hidden',
                      background: 'var(--paper-2)',
                      display: 'grid',
                      placeItems: 'center',
                      flexShrink: 0
                    }}
                  >
                    {top.img_url ? (
                      <img
                        src={top.img_url}
                        alt=""
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    ) : null}
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <Link
                      to={`/product/${encodeURIComponent(top.asin)}`}
                      style={{
                        color: 'var(--ink)',
                        display: '-webkit-box',
                        fontSize: 22,
                        fontWeight: 400,
                        lineHeight: 1.25,
                        overflow: 'hidden',
                        WebkitBoxOrient: 'vertical',
                        WebkitLineClamp: 2
                      }}
                    >
                      {top.title}
                    </Link>
                    <div className="meta-line" style={{ marginTop: 6 }}>
                      {[top.brand_name, top.category_name].filter(Boolean).join(' · ')}
                    </div>
                    <div className="row gap-6" style={{ marginTop: 14, alignItems: 'baseline' }}>
                      <span className="price">{formatProductPrice(top.price)}</span>
                      <span style={{ fontSize: 24 }}>
                        {((top.value_score || 0) * 100).toFixed(1)}
                      </span>
                      <span className="meta-line">value score / 100</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="card">
            <div className="card-body">
              <div className="row between" style={{ alignItems: 'baseline', marginBottom: 'var(--s-4)' }}>
                <h2 className="card-title">Top 25</h2>
                {loading && <span className="meta-line">Recomputing</span>}
              </div>

              {error ? (
                <ErrorBanner error={error} />
              ) : rows.length === 0 && loading ? (
                <div className="stack">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="skeleton" style={{ height: 60 }} />
                  ))}
                </div>
              ) : rows.length === 0 ? (
                <Empty title="No products match these weights." />
              ) : (
                <div className="plain-list">
                  {rows.map((r, i) => (
                    <RankRow key={r.asin} rank={i + 1} row={r} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function RankRow({ rank, row }) {
  const scorePct = Math.max(0, Math.min(100, (row.value_score || 0) * 100));
  return (
    <Link to={`/product/${encodeURIComponent(row.asin)}`} className="rank-row">
      <span className="meta-line">#{rank}</span>
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: 'var(--r)',
          overflow: 'hidden',
          background: 'var(--paper-2)'
        }}
      >
        {row.img_url && (
          <img
            src={row.img_url}
            alt=""
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        )}
      </div>
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            display: '-webkit-box',
            fontWeight: 400,
            overflow: 'hidden',
            WebkitBoxOrient: 'vertical',
            WebkitLineClamp: 1
          }}
        >
          {row.title}
        </div>
        <div className="meta-line">
          {[row.category_name, row.brand_name].filter(Boolean).join(' · ')}
        </div>
      </div>
      <Rating stars={row.stars} count={row.review_count} size={12} />
      <span>{formatProductPrice(row.price)}</span>
      <span>{scorePct.toFixed(1)} / 100</span>
    </Link>
  );
}
