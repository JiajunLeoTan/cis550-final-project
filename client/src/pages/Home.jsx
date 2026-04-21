import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';
import { useApi } from '../api/useApi.js';
import ProductCard from '../components/ProductCard.jsx';
import { SkeletonGrid } from '../components/States.jsx';
import AnimatedNumber from '../components/AnimatedNumber.jsx';

const HERO_STATS = [
  { label: 'Products indexed', value: 1426336, suffix: '', format: (n) => Math.round(n).toLocaleString() },
  { label: 'Brands tracked', value: 886028, suffix: '', format: (n) => Math.round(n).toLocaleString() },
  { label: 'Categories', value: 248, suffix: '', format: (n) => Math.round(n).toLocaleString() }
];

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
      <section className="container fade-in" style={{ paddingTop: 'var(--s-8)' }}>
        <div
          style={{
            position: 'relative',
            borderRadius: 'var(--r-xl)',
            overflow: 'hidden',
            padding: 'clamp(40px, 6vw, 80px) clamp(24px, 4vw, 56px)',
            background:
              'linear-gradient(130deg, #1a1f1d 0%, #232a26 40%, #2a3330 100%)',
            color: 'var(--ivory-100)',
            boxShadow: 'var(--sh-3)'
          }}
        >
          <div
            aria-hidden
            style={{
              position: 'absolute',
              inset: 0,
              background:
                'radial-gradient(600px 300px at 80% 10%, rgba(202, 160, 74, 0.22), transparent 60%), radial-gradient(500px 280px at 10% 80%, rgba(46, 138, 106, 0.22), transparent 65%)',
              pointerEvents: 'none'
            }}
          />
          <div style={{ position: 'relative', maxWidth: 780 }}>
            <span
              className="eyebrow"
              style={{ color: 'var(--gold-200)' }}
            >
              Product intelligence platform
            </span>
            <h1
              className="h-display h-display--xl"
              style={{ marginTop: 14, color: 'var(--ivory-100)' }}
            >
              The catalog you can{' '}
              <span style={{ fontStyle: 'italic', color: 'var(--gold-400)' }}>
                actually
              </span>{' '}
              reason about.
            </h1>
            <p
              className="lead"
              style={{ marginTop: 'var(--s-5)', color: 'rgba(251, 247, 238, 0.78)' }}
            >
              Search, compare, and rank 1.4&nbsp;million products by real value —
              rating strength, review depth, price efficiency, and momentum. No hype,
              no filler.
            </p>

            <form
              onSubmit={submit}
              className="row gap-2"
              style={{ marginTop: 'var(--s-8)', maxWidth: 620 }}
            >
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search products by keyword…"
                className="input"
                style={{
                  background: 'rgba(255, 253, 245, 0.08)',
                  border: '1px solid rgba(255, 253, 245, 0.2)',
                  color: 'var(--ivory-100)',
                  fontSize: 16,
                  padding: '14px 18px'
                }}
                aria-label="Search products"
              />
              <button className="btn btn--gold btn--lg" type="submit">
                Search
              </button>
            </form>

            <div
              className="row gap-6"
              style={{ marginTop: 'var(--s-10)', flexWrap: 'wrap' }}
            >
              {HERO_STATS.map((s) => (
                <div key={s.label}>
                  <div
                    className="text-num"
                    style={{
                      fontFamily: 'var(--font-display)',
                      fontSize: 28,
                      fontWeight: 600,
                      color: 'var(--ivory-100)'
                    }}
                  >
                    <AnimatedNumber value={s.value} format={s.format} duration={1200} />
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      letterSpacing: '0.12em',
                      textTransform: 'uppercase',
                      color: 'rgba(251, 247, 238, 0.55)'
                    }}
                  >
                    {s.label}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="container section">
        <div className="grid grid-4 stagger">
          <EntryCard
            eyebrow="01 / Browse"
            title="Deals worth taking"
            body="Live discounts ranked by savings percent and depth of reviews."
            to="/browse#deals"
            accent="emerald"
          />
          <EntryCard
            eyebrow="02 / Trending"
            title="What's catching fire"
            body="Momentum signals from review velocity across every category."
            to="/browse#trending"
            accent="gold"
          />
          <EntryCard
            eyebrow="03 / Analytics"
            title="Category intelligence"
            body="Brand performance, review credibility, category comparisons."
            to="/analytics"
            accent="graphite"
          />
          <EntryCard
            eyebrow="04 / Rankings"
            title="Value rankings"
            body="Tune your own weights. Watch the ranking recompute live."
            to="/value"
            accent="ember"
          />
        </div>
      </section>

      <section className="container section">
        <div className="section-header">
          <div className="title-block">
            <span className="eyebrow">Proven picks</span>
            <h2 className="h-display h-display--lg">Reviewed and loved.</h2>
          </div>
          <Link to="/value" className="btn btn--ghost">
            See full rankings
          </Link>
        </div>
        {provenLoading ? (
          <SkeletonGrid count={4} />
        ) : provenPicks.length === 0 ? (
          <div className="card card-body muted">
            Not enough review coverage yet to surface proven picks.
          </div>
        ) : (
          <div className="grid grid-4 stagger">
            {provenPicks.map((p) => (
              <ProductCard
                key={p.asin}
                product={p}
                badge={{ label: 'Proven', tone: 'emerald' }}
              />
            ))}
          </div>
        )}
      </section>

      <section className="container section">
        <div className="section-header">
          <div className="title-block">
            <span className="eyebrow">Featured deals</span>
            <h2 className="h-display h-display--lg">Under $120, genuinely good.</h2>
          </div>
          <Link to="/browse#deals" className="btn btn--ghost">
            Browse all deals
          </Link>
        </div>
        {dealsLoading ? (
          <SkeletonGrid count={4} />
        ) : featured.length === 0 ? (
          <div className="card card-body muted">No deals available right now.</div>
        ) : (
          <div className="grid grid-4 stagger">
            {featured.map((p) => (
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
    </>
  );
}

function EntryCard({ eyebrow, title, body, to, accent }) {
  const tone = {
    emerald: { bg: 'var(--emerald-100)', ink: 'var(--emerald-900)' },
    gold: { bg: 'rgba(202, 160, 74, 0.18)', ink: 'var(--gold-600)' },
    graphite: { bg: 'var(--ivory-200)', ink: 'var(--ink)' },
    ember: { bg: 'rgba(187, 90, 61, 0.12)', ink: 'var(--ember-500)' }
  }[accent || 'emerald'];

  return (
    <Link to={to} className="card card-hover" style={{ display: 'block' }}>
      <div className="card-body" style={{ minHeight: 200, display: 'flex', flexDirection: 'column' }}>
        <span className="eyebrow" style={{ color: tone.ink }}>
          {eyebrow}
        </span>
        <h3
          className="h-display"
          style={{ fontSize: 22, margin: '10px 0 8px', letterSpacing: '-0.01em' }}
        >
          {title}
        </h3>
        <p className="muted" style={{ margin: 0, flex: 1 }}>
          {body}
        </p>
        <div
          className="row"
          style={{ marginTop: 16, color: tone.ink, fontWeight: 600, fontSize: 14 }}
        >
          Explore
          <span
            aria-hidden
            style={{
              display: 'inline-block',
              transition: 'transform var(--dur-2) var(--ease-out)'
            }}
          >
            →
          </span>
        </div>
      </div>
    </Link>
  );
}
