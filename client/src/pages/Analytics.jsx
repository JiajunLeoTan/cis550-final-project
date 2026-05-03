import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';
import { useApi } from '../api/useApi.js';
import HorizontalBars from '../components/charts/HorizontalBars.jsx';
import LineChart from '../components/charts/LineChart.jsx';
import { Empty, ErrorBanner } from '../components/States.jsx';
import { formatCount, formatCurrency, formatMonth, formatStars } from '../utils/format.js';

export default function Analytics() {
  const navigate = useNavigate();
  const [metric, setMetric] = useState('product_count');
  const [category, setCategory] = useState('');

  const { data: categories } = useApi((opts) => api.categories(opts), []);
  const {
    data: compare,
    loading: compareLoading,
    error: compareError
  } = useApi((opts) => api.categoriesCompare(opts), []);
  const {
    data: brands,
    loading: brandsLoading,
    error: brandsError
  } = useApi((opts) => api.brandsPerformance(opts), []);

  useEffect(() => {
    if (!category && categories?.length) {
      setCategory(categories[0].category_name);
    }
  }, [categories, category]);

  const { data: trend, loading: trendLoading } = useApi(
    (opts) => (category ? api.reviewsTrend({ category }, opts) : Promise.resolve([])),
    [category],
    { skip: !category }
  );

  const categoryChartData = useMemo(() => {
    const rows = (compare || []).filter((r) => r[metric] != null);
    const sorted = [...rows].sort((a, b) => (b[metric] || 0) - (a[metric] || 0));
    return sorted.slice(0, 12).map((r) => ({
      label: r.category_name,
      value: Number(r[metric])
    }));
  }, [compare, metric]);

  const brandRows = useMemo(() => {
    const rows = brands || [];
    return [...rows]
      .filter((r) => isDisplayBrand(r.brand_name))
      .map(normalizeBrandRow)
      .filter((r) => r.avg_review_score != null)
      .sort(
        (a, b) =>
          b.avg_review_score - a.avg_review_score ||
          safeNumber(b.qualifying_review_count) - safeNumber(a.qualifying_review_count) ||
          safeNumber(b.total_helpful_votes) - safeNumber(a.total_helpful_votes) ||
          String(a.brand_name).localeCompare(String(b.brand_name))
      )
      .slice(0, 12);
  }, [brands]);

  const trendChart = useMemo(() => {
    const rows = trend || [];
    return {
      xLabels: rows.map((r) => formatMonth(r.review_month)),
      xValues: rows.map((r) => r.review_month),
      overall: rows.map((r) => r.overall_avg_rating),
      high: rows.map((r) => r.high_cred_avg),
      low: rows.map((r) => r.low_cred_avg),
      volume: rows.map((r) => r.total_reviews)
    };
  }, [trend]);

  const trendSummary = useMemo(() => {
    const rows = trend || [];
    if (!rows.length) return null;
    let total = 0;
    let verifiedSum = 0;
    let verifiedW = 0;
    let unverifiedSum = 0;
    let unverifiedW = 0;
    rows.forEach((r) => {
      const monthTotal = Number(r.total_reviews) || 0;
      const verified = Number(r.verified_count) || 0;
      const unverified = Math.max(0, monthTotal - verified);
      total += monthTotal;
      if (r.high_cred_avg != null && verified > 0) {
        verifiedSum += Number(r.high_cred_avg) * verified;
        verifiedW += verified;
      }
      if (r.low_cred_avg != null && unverified > 0) {
        unverifiedSum += Number(r.low_cred_avg) * unverified;
        unverifiedW += unverified;
      }
    });
    const verifiedAvg = verifiedW > 0 ? verifiedSum / verifiedW : null;
    const unverifiedAvg = unverifiedW > 0 ? unverifiedSum / unverifiedW : null;
    const gap = verifiedAvg != null && unverifiedAvg != null
      ? verifiedAvg - unverifiedAvg
      : null;
    return {
      total,
      verifiedAvg,
      unverifiedAvg,
      verifiedW,
      unverifiedW,
      gap
    };
  }, [trend]);

  const metricMeta = {
    product_count: { label: 'Product count', format: (v) => formatCount(Math.round(v)) },
    avg_rating: { label: 'Average rating', format: (v) => formatStars(v) },
    avg_price: { label: 'Average price', format: (v) => formatCurrency(v) }
  };

  return (
    <div className="container stack-lg">
      <header style={{ paddingTop: 'var(--s-8)' }}>
        <span className="kicker">Statistics &amp; charts &middot; Issue 01</span>
        <h1 className="page-title">Analytics.</h1>
        <p className="lead">
          Category, brand, and review trends from the product corpus, shown as compact
          comparisons rather than dashboard decoration.
        </p>
      </header>

      <section>
        <header className="section-header">
          <span className="section-num">01</span>
          <h2 className="section-title">Categories compared</h2>
          <div className="section-actions">
            <div className="tab-row" role="tablist" aria-label="Category metric">
              {Object.entries(metricMeta).map(([k, v]) => (
                <button
                  key={k}
                  className={`tab-btn${metric === k ? ' active' : ''}`}
                  onClick={() => setMetric(k)}
                >
                  {v.label}
                </button>
              ))}
            </div>
          </div>
        </header>

        {compareError && <ErrorBanner error={compareError} />}
        {compareLoading ? (
          <div className="skeleton" style={{ height: 320 }} />
        ) : categoryChartData.length === 0 ? (
          <Empty title="No data for this metric." />
        ) : (
          <>
            <HorizontalBars
              data={categoryChartData}
              valueFormat={metricMeta[metric].format}
              height={320}
              maxLabelChars={24}
              getHref={(d) => `/category/${encodeURIComponent(d.label)}`}
              onSelect={(d) => navigate(`/category/${encodeURIComponent(d.label)}`)}
            />
            <p className="chart-caption">
              Top 12 categories by the selected metric. Values are printed beside each bar.
            </p>
          </>
        )}
      </section>

      <section>
        <header className="section-header">
          <span className="section-num">02</span>
          <h2 className="section-title">Brand leaderboard</h2>
        </header>

        {brandsError && <ErrorBanner error={brandsError} />}
        {brandsLoading ? (
          <div className="skeleton" style={{ height: 420 }} />
        ) : brandRows.length === 0 ? (
          <Empty
            title="No qualifying brands yet."
            description="Brand performance requires verified review coverage; the current dataset is sparse."
          />
        ) : (
          <>
            <BrandLeaderboard rows={brandRows} />
            <p className="chart-caption">
              Ranked by verified review score, then review sample size and helpful votes.
            </p>
          </>
        )}
      </section>

      <section>
        <header className="section-header">
          <span className="section-num">03</span>
          <h2 className="section-title">Verified vs unverified ratings</h2>
          <div className="section-actions">
            <select
              className="select analytics-select"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              aria-label="Category"
            >
              {(categories || []).map((c) => (
                <option key={c.category_id} value={c.category_name}>
                  {c.category_name}
                </option>
              ))}
            </select>
          </div>
        </header>

        <p className="section-deck">
          Monthly average star rating for {category || 'the selected category'}, split by whether the
          reviewer purchased the item. Verified buyers are a more reliable signal, so a wider gap
          means unverified ratings are skewing the overall stars up or down.
        </p>

        {trendLoading ? (
          <div className="skeleton" style={{ height: 320 }} />
        ) : (trend || []).length === 0 ? (
          <Empty
            title="No review timeline for this category."
            description="The loaded review corpus is smaller than expected, so some categories have no monthly signal."
          />
        ) : (
          <>
            {trendSummary && (
              <dl className="stat-row">
                <div className="stat">
                  <dt>Reviews</dt>
                  <dd>{formatCount(trendSummary.total)}</dd>
                </div>
                <div className="stat">
                  <dt>Verified avg</dt>
                  <dd>
                    {trendSummary.verifiedAvg != null
                      ? `${trendSummary.verifiedAvg.toFixed(2)} ★`
                      : '—'}
                    <span className="stat-sub">
                      {trendSummary.verifiedW > 0
                        ? `${formatCount(trendSummary.verifiedW)} reviews`
                        : 'no data'}
                    </span>
                  </dd>
                </div>
                <div className="stat">
                  <dt>Unverified avg</dt>
                  <dd>
                    {trendSummary.unverifiedAvg != null
                      ? `${trendSummary.unverifiedAvg.toFixed(2)} ★`
                      : '—'}
                    <span className="stat-sub">
                      {trendSummary.unverifiedW > 0
                        ? `${formatCount(trendSummary.unverifiedW)} reviews`
                        : 'no data'}
                    </span>
                  </dd>
                </div>
                <div className="stat">
                  <dt>Gap</dt>
                  <dd>
                    {trendSummary.gap != null
                      ? `${trendSummary.gap > 0 ? '+' : ''}${trendSummary.gap.toFixed(2)} ★`
                      : '—'}
                    <span className="stat-sub">verified − unverified</span>
                  </dd>
                </div>
              </dl>
            )}

            <LineChart
              xLabels={trendChart.xLabels}
              xValues={trendChart.xValues}
              volumes={trendChart.volume}
              yLabel="Avg star rating"
              volumeLabel="Reviews / month"
              series={[
                {
                  label: 'Overall avg',
                  color: 'var(--ink)',
                  values: trendChart.overall
                },
                {
                  label: 'Verified buyers',
                  color: 'var(--accent)',
                  values: trendChart.high
                },
                {
                  label: 'Unverified',
                  color: 'var(--ink-3)',
                  values: trendChart.low,
                  dashed: true
                }
              ]}
              valueFormat={(v) => Number(v).toFixed(1)}
              yDomain={[1, 5]}
              height={280}
            />
            <p className="chart-caption">
              A wider gap between the verified and unverified lines means unverified reviewers are
              rating differently from people who actually bought the item. The bars below show how many
              reviews each month is based on; tall bars are higher-confidence months.
            </p>
          </>
        )}
      </section>
    </div>
  );
}

function BrandLeaderboard({ rows }) {
  return (
    <div className="brand-leaderboard" role="table" aria-label="Brand leaderboard">
      <div className="brand-row brand-row--head" role="row">
        <div role="columnheader">Rank</div>
        <div role="columnheader">Brand</div>
        <div role="columnheader">Verified score</div>
        <div role="columnheader">Verified reviews</div>
        <div role="columnheader">Helpful votes</div>
        <div role="columnheader">Product avg</div>
      </div>
      {rows.map((row, index) => (
        <div className="brand-row" role="row" key={row.brand_name}>
          <div className="brand-rank" role="cell">
            #{index + 1}
          </div>
          <div className="brand-main" role="cell">
            <Link
              className="brand-name brand-name-link"
              to={`/brand/${encodeURIComponent(row.brand_name)}`}
            >
              {row.brand_name}
            </Link>
            {row.total_products > 0 && (
              <div className="brand-subline">
                {formatCount(row.total_products)} best sellers
              </div>
            )}
          </div>
          <MetricCell
            value={formatStars(row.avg_review_score)}
            label="verified avg"
            strong
          />
          <MetricCell
            value={formatOptionalCount(row.qualifying_review_count)}
            label="verified reviews"
          />
          <MetricCell
            value={formatOptionalCount(row.total_helpful_votes)}
            label="votes"
            optional
          />
          <MetricCell
            value={formatOptionalStars(row.avg_product_rating)}
            label="product avg"
            optional
          />
        </div>
      ))}
    </div>
  );
}

function isDisplayBrand(name) {
  const text = String(name || '').trim();
  if (!text) return false;
  return !/^\d+\s*(pack|packs|piece|pieces|pcs|count|ct|oz|ml|inch|in)\b/i.test(text);
}

function normalizeBrandRow(row) {
  return {
    ...row,
    avg_product_rating: readNumber(row, ['avg_product_rating', 'product_avg_rating']),
    avg_review_score: readNumber(row, 'avg_review_score'),
    qualifying_review_count: readNumber(row, [
      'qualifying_review_count',
      'verified_review_count',
      'verified_reviews'
    ]),
    total_helpful_votes: readNumber(row, 'total_helpful_votes'),
    total_products: readNumber(row, 'total_products')
  };
}

function readNumber(row, key) {
  const keys = Array.isArray(key) ? key : [key];
  const value = keys.map((k) => row?.[k]).find((v) => v !== undefined && v !== null && v !== '');
  if (value === undefined || value === null || value === '') return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function safeNumber(value) {
  return value == null ? 0 : value;
}

function formatOptionalCount(value) {
  return value == null ? '-' : formatCount(value);
}

function formatOptionalStars(value) {
  return value == null ? '-' : formatStars(value);
}

function MetricCell({ value, label, strong = false, optional = false }) {
  const className = [
    'brand-metric',
    strong ? 'brand-metric--primary' : 'brand-metric--secondary',
    optional ? 'brand-metric--optional' : ''
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={className} role="cell">
      <span className={strong ? 'brand-metric-value brand-metric-value--strong' : 'brand-metric-value'}>
        {value}
      </span>
      <span className="brand-metric-label">{label}</span>
    </div>
  );
}
