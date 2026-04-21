import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import { useApi } from '../api/useApi.js';
import Rating from '../components/Rating.jsx';
import AnimatedNumber from '../components/AnimatedNumber.jsx';
import { Empty, ErrorBanner } from '../components/States.jsx';
import { formatCount, formatCurrency } from '../utils/format.js';

const PRESETS = [
  { name: 'Balanced', w: { wRating: 0.25, wReviews: 0.25, wPriceEff: 0.25, wRecent: 0.25 } },
  { name: 'Quality first', w: { wRating: 0.5, wReviews: 0.3, wPriceEff: 0.1, wRecent: 0.1 } },
  { name: 'Best bang for buck', w: { wRating: 0.2, wReviews: 0.15, wPriceEff: 0.55, wRecent: 0.1 } },
  { name: 'Hot right now', w: { wRating: 0.15, wReviews: 0.2, wPriceEff: 0.1, wRecent: 0.55 } }
];

const WEIGHT_META = [
  { key: 'wRating', label: 'Rating strength', description: 'Weight on 1–5 star score.' },
  { key: 'wReviews', label: 'Review depth', description: 'Weight on total review volume.' },
  { key: 'wPriceEff', label: 'Price efficiency', description: 'Weight on cheapness within category.' },
  { key: 'wRecent', label: 'Recent momentum', description: 'Weight on reviews in the last 3 months.' }
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

  const sum = WEIGHT_META.reduce((s, m) => s + (weights[m.key] || 0), 0);

  const rows = useMemo(() => (data || []).slice(0, 25), [data]);
  const top = rows[0];

  const applyPreset = (preset) => setWeights(preset.w);

  return (
    <div className="container stack-lg fade-in">
      <div className="section-header">
        <div className="title-block">
          <span className="eyebrow">Value Rankings</span>
          <h1 className="h-display h-display--lg">
            Tune the weights. The ranking responds.
          </h1>
          <p className="lead" style={{ maxWidth: 620 }}>
            We normalize each dimension to 0–1 per product, scale by your weights, and
            re-rank the whole catalog live.
          </p>
        </div>
      </div>

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
            top: 88,
            background:
              'linear-gradient(165deg, var(--surface), var(--ivory-50))'
          }}
        >
          <span className="eyebrow">Presets</span>
          <div className="row row-wrap gap-2" style={{ marginTop: 10, marginBottom: 20 }}>
            {PRESETS.map((p) => (
              <button
                key={p.name}
                className="btn btn--ghost btn--sm"
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
                  <span
                    className="text-num"
                    style={{ fontSize: 12, color: 'var(--ink-soft)' }}
                  >
                    {weights[m.key].toFixed(2)}
                  </span>
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
                <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                  {m.description}
                </div>
              </div>
            ))}
          </div>

          <div
            style={{
              marginTop: 'var(--s-6)',
              paddingTop: 'var(--s-4)',
              borderTop: '1px solid var(--line)',
              fontSize: 12,
              color: 'var(--ink-muted)',
              fontFamily: 'var(--font-mono)'
            }}
          >
            Σ weights = {sum.toFixed(2)} · server renormalizes
          </div>
        </aside>

        <div className="stack-lg">
          <div
            className="card"
            style={{
              padding: 'var(--s-6)',
              background:
                'linear-gradient(150deg, var(--graphite-900), var(--graphite-800))',
              color: 'var(--ivory-100)',
              position: 'relative',
              overflow: 'hidden'
            }}
          >
            <div
              aria-hidden
              style={{
                position: 'absolute',
                inset: 0,
                background:
                  'radial-gradient(400px 200px at 90% 20%, rgba(202, 160, 74, 0.2), transparent 60%)'
              }}
            />
            <div style={{ position: 'relative' }}>
              <span className="eyebrow" style={{ color: 'var(--gold-200)' }}>
                #1 for your weights
              </span>
              {loading && !top ? (
                <div className="skeleton" style={{ height: 120, marginTop: 12, background: 'rgba(255,255,255,0.08)' }} />
              ) : error ? (
                <ErrorBanner error={error} />
              ) : !top ? (
                <div className="muted" style={{ color: 'rgba(251,247,238,0.7)', marginTop: 8 }}>
                  No products matched.
                </div>
              ) : (
                <div className="row gap-6" style={{ marginTop: 14, alignItems: 'center' }}>
                  <div
                    style={{
                      width: 120,
                      height: 120,
                      borderRadius: 'var(--r-md)',
                      overflow: 'hidden',
                      background: 'rgba(255,253,245,0.08)',
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
                        fontFamily: 'var(--font-display)',
                        fontSize: 22,
                        color: 'var(--ivory-100)',
                        fontWeight: 500,
                        letterSpacing: '-0.01em',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden'
                      }}
                    >
                      {top.title}
                    </Link>
                    <div className="row gap-4 muted" style={{ color: 'rgba(251,247,238,0.7)', fontSize: 13, marginTop: 6 }}>
                      {top.brand_name && <span>{top.brand_name}</span>}
                      {top.category_name && <span>· {top.category_name}</span>}
                    </div>
                    <div className="row gap-6" style={{ marginTop: 14, alignItems: 'baseline' }}>
                      <span
                        style={{
                          fontFamily: 'var(--font-display)',
                          fontSize: 28,
                          color: 'var(--gold-400)'
                        }}
                      >
                        <AnimatedNumber
                          value={(top.value_score || 0) * 100}
                          format={(n) => n.toFixed(1)}
                          duration={600}
                        />
                      </span>
                      <span style={{ color: 'rgba(251,247,238,0.6)', fontSize: 12 }}>
                        value score / 100
                      </span>
                      <span style={{ color: 'var(--ivory-100)', fontSize: 16, fontWeight: 600 }}>
                        {formatCurrency(top.price)}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="card">
            <div className="card-body">
              <div className="section-header" style={{ marginBottom: 'var(--s-4)' }}>
                <div className="title-block">
                  <span className="eyebrow">Ranked list</span>
                  <h2 className="h-display h-display--md">Top 25</h2>
                </div>
                {loading && (
                  <span className="muted text-num" style={{ fontSize: 12 }}>
                    Recomputing…
                  </span>
                )}
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
                <div className="stack" style={{ gap: 6 }}>
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
    <Link
      to={`/product/${encodeURIComponent(row.asin)}`}
      className="card-hover"
      style={{
        display: 'grid',
        gridTemplateColumns: '48px 52px minmax(0, 1fr) 140px 120px 140px',
        gap: 'var(--s-4)',
        alignItems: 'center',
        padding: '10px 14px',
        borderRadius: 'var(--r-md)',
        transition: 'background-color var(--dur-2) var(--ease-out)',
        borderBottom: '1px solid var(--line)'
      }}
    >
      <span
        className="text-num"
        style={{ color: 'var(--ink-muted)', fontSize: 13 }}
      >
        #{rank}
      </span>
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: 'var(--r-sm)',
          overflow: 'hidden',
          background: 'var(--ivory-200)'
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
            fontWeight: 600,
            display: '-webkit-box',
            WebkitLineClamp: 1,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden'
          }}
        >
          {row.title}
        </div>
        <div
          className="muted"
          style={{ fontSize: 12, display: 'flex', gap: 8 }}
        >
          {row.category_name && <span>{row.category_name}</span>}
          {row.brand_name && <span>· {row.brand_name}</span>}
        </div>
      </div>
      <Rating stars={row.stars} count={row.review_count} size={12} />
      <span className="text-num" style={{ fontWeight: 600 }}>
        {formatCurrency(row.price)}
      </span>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '60px 1fr',
          alignItems: 'center',
          gap: 8
        }}
      >
        <span
          className="text-num"
          style={{ fontWeight: 600, color: 'var(--emerald-700)' }}
        >
          {scorePct.toFixed(1)}
        </span>
        <div
          style={{
            height: 6,
            background: 'var(--ivory-200)',
            borderRadius: 'var(--r-full)',
            overflow: 'hidden'
          }}
        >
          <div
            style={{
              width: `${scorePct}%`,
              height: '100%',
              background:
                'linear-gradient(90deg, var(--emerald-500), var(--gold-500))',
              transition: 'width 520ms var(--ease-out)'
            }}
          />
        </div>
      </div>
    </Link>
  );
}
