import { useEffect, useMemo, useState } from 'react';
import { api } from '../api/client.js';
import { useApi } from '../api/useApi.js';
import HorizontalBars from '../components/charts/HorizontalBars.jsx';
import LineChart from '../components/charts/LineChart.jsx';
import { Empty, ErrorBanner } from '../components/States.jsx';
import { formatCount, formatCurrency, formatMonth, formatStars } from '../utils/format.js';

export default function Analytics() {
  const [metric, setMetric] = useState('product_count');
  const [brandMetric, setBrandMetric] = useState('avg_review_score');
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

  const brandChartData = useMemo(() => {
    const rows = brands || [];
    const sorted = [...rows].sort((a, b) => (b[brandMetric] || 0) - (a[brandMetric] || 0));
    return sorted.slice(0, 12).map((r) => ({
      label: r.brand_name || '—',
      value: Number(r[brandMetric] || 0)
    }));
  }, [brands, brandMetric]);

  const trendChart = useMemo(() => {
    const rows = trend || [];
    const xLabels = rows.map((r) => formatMonth(r.review_month));
    return {
      xLabels,
      overall: rows.map((r) => r.overall_avg_rating),
      high: rows.map((r) => r.high_cred_avg),
      low: rows.map((r) => r.low_cred_avg),
      volume: rows.map((r) => r.total_reviews)
    };
  }, [trend]);

  const metricMeta = {
    product_count: { label: 'Product count', format: (v) => formatCount(Math.round(v)) },
    avg_rating: { label: 'Average rating', format: (v) => formatStars(v) },
    avg_price: { label: 'Average price', format: (v) => formatCurrency(v) }
  };

  const brandMetricMeta = {
    avg_review_score: { label: 'Avg review score', format: (v) => formatStars(v) },
    total_helpful_votes: { label: 'Helpful votes', format: (v) => formatCount(Math.round(v)) },
    total_products: { label: 'Best-seller products', format: (v) => formatCount(Math.round(v)) }
  };

  return (
    <div className="container stack-lg fade-in">
      <div className="section-header">
        <div className="title-block">
          <span className="eyebrow">Analytics</span>
          <h1 className="h-display h-display--lg">Signals across the catalog.</h1>
        </div>
      </div>

      <section className="card">
        <div className="card-body">
          <div className="section-header" style={{ marginBottom: 'var(--s-4)' }}>
            <div className="title-block">
              <span className="eyebrow">Categories</span>
              <h2 className="h-display h-display--md">How they compare</h2>
            </div>
            <div className="row gap-2">
              {Object.entries(metricMeta).map(([k, v]) => (
                <button
                  key={k}
                  className={`btn btn--sm ${metric === k ? '' : 'btn--ghost'}`}
                  onClick={() => setMetric(k)}
                >
                  {v.label}
                </button>
              ))}
            </div>
          </div>

          {compareError && <ErrorBanner error={compareError} />}
          {compareLoading ? (
            <div className="skeleton" style={{ height: 320 }} />
          ) : categoryChartData.length === 0 ? (
            <Empty title="No data for this metric." />
          ) : (
            <HorizontalBars
              data={categoryChartData}
              valueFormat={metricMeta[metric].format}
              color="var(--emerald-600)"
              height={320}
            />
          )}
        </div>
      </section>

      <section className="card">
        <div className="card-body">
          <div className="section-header" style={{ marginBottom: 'var(--s-4)' }}>
            <div className="title-block">
              <span className="eyebrow">Brands</span>
              <h2 className="h-display h-display--md">Top performers</h2>
            </div>
            <div className="row gap-2">
              {Object.entries(brandMetricMeta).map(([k, v]) => (
                <button
                  key={k}
                  className={`btn btn--sm ${brandMetric === k ? '' : 'btn--ghost'}`}
                  onClick={() => setBrandMetric(k)}
                >
                  {v.label}
                </button>
              ))}
            </div>
          </div>

          {brandsError && <ErrorBanner error={brandsError} />}
          {brandsLoading ? (
            <div className="skeleton" style={{ height: 320 }} />
          ) : brandChartData.length === 0 ? (
            <Empty
              title="No qualifying brands yet."
              description="Brand performance requires verified review coverage — the current dataset is sparse."
            />
          ) : (
            <HorizontalBars
              data={brandChartData}
              valueFormat={brandMetricMeta[brandMetric].format}
              color="var(--gold-500)"
              height={380}
            />
          )}
        </div>
      </section>

      <section className="card">
        <div className="card-body">
          <div className="section-header" style={{ marginBottom: 'var(--s-4)' }}>
            <div className="title-block">
              <span className="eyebrow">Reviews trend</span>
              <h2 className="h-display h-display--md">Credibility over time</h2>
            </div>
            <select
              className="select"
              style={{ maxWidth: 260 }}
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {(categories || []).map((c) => (
                <option key={c.category_id} value={c.category_name}>
                  {c.category_name}
                </option>
              ))}
            </select>
          </div>

          {trendLoading ? (
            <div className="skeleton" style={{ height: 320 }} />
          ) : (trend || []).length === 0 ? (
            <Empty
              title="No review timeline for this category."
              description="The loaded review corpus is smaller than expected, so some categories have no monthly signal."
            />
          ) : (
            <>
              <LineChart
                xLabels={trendChart.xLabels}
                series={[
                  {
                    label: 'Overall avg',
                    color: 'var(--graphite-700)',
                    values: trendChart.overall
                  },
                  {
                    label: 'High-cred reviewers',
                    color: 'var(--emerald-600)',
                    values: trendChart.high
                  },
                  {
                    label: 'Low-cred reviewers',
                    color: 'var(--ember-500)',
                    values: trendChart.low,
                    dashed: true
                  }
                ]}
                valueFormat={(v) => Number(v).toFixed(1)}
                yDomain={[1, 5]}
                height={280}
              />
              <div
                className="muted"
                style={{ fontSize: 12, marginTop: 10, fontFamily: 'var(--font-mono)' }}
              >
                Credibility = reviewers with ≥10 reviews. The gap between high and low cred
                groups hints at how much casual-reviewer bias skews the average.
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
