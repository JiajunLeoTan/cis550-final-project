import { Link, useParams } from 'react-router-dom';
import { api } from '../api/client.js';
import { useApi } from '../api/useApi.js';
import { useCart } from '../context/CartContext.jsx';
import Rating from '../components/Rating.jsx';
import StarIcon from '../components/StarIcon.jsx';
import ProductCard from '../components/ProductCard.jsx';
import { Empty, ErrorBanner } from '../components/States.jsx';
import BarChart from '../components/charts/BarChart.jsx';
import { formatCount, formatCurrency, formatDate, formatStars } from '../utils/format.js';

export default function ProductDetail() {
  const { asin } = useParams();
  const { has, toggle } = useCart();

  const {
    data: product,
    loading,
    error
  } = useApi((opts) => api.product(asin, opts), [asin]);

  const { data: rating } = useApi(
    (opts) => api.ratingDistribution(asin, opts),
    [asin]
  );
  const { data: reviews, loading: reviewsLoading } = useApi(
    (opts) => api.helpfulReviews(asin, opts),
    [asin]
  );
  const { data: alternatives, loading: altLoading } = useApi(
    (opts) => api.alternatives(asin, opts),
    [asin]
  );

  if (loading) return <ProductSkeleton />;
  if (error)
    return (
      <div className="container">
        <ErrorBanner error={error} />
      </div>
    );
  if (!product)
    return (
      <div className="container">
        <Empty title="Product not found." />
      </div>
    );

  const inCart = has(product.asin);
  const totalReviews = (rating || []).reduce((s, r) => s + (r.review_count || 0), 0);
  const avgVerifiedRatio =
    totalReviews > 0
      ? (rating || []).reduce(
          (s, r) => s + (r.verified_ratio || 0) * (r.review_count || 0),
          0
        ) / totalReviews
      : null;

  return (
    <div className="container stack-lg fade-in">
      <div className="row" style={{ fontSize: 13 }}>
        <Link to="/browse" className="muted">
          ← Back to browse
        </Link>
      </div>

      <section
        className="grid gap-8"
        style={{ gridTemplateColumns: 'minmax(0, 1.1fr) minmax(0, 1fr)' }}
      >
        <div
          className="card"
          style={{
            overflow: 'hidden',
            aspectRatio: '4 / 3',
            display: 'grid',
            placeItems: 'center',
            background:
              'linear-gradient(140deg, var(--ivory-200), var(--ivory-100) 60%, var(--ivory-50))'
          }}
        >
          {product.img_url ? (
            <img
              src={product.img_url}
              alt={product.title}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <span className="muted" style={{ fontFamily: 'var(--font-mono)' }}>
              No image
            </span>
          )}
        </div>

        <div className="stack">
          <div className="row row-wrap gap-2">
            {product.category_name && (
              <span className="pill">{product.category_name}</span>
            )}
            {product.brand_name && <span className="pill">{product.brand_name}</span>}
            {product.is_best_seller && (
              <span className="pill pill--gold">Best seller</span>
            )}
          </div>
          <h1 className="h-display h-display--lg" style={{ margin: 0 }}>
            {product.title}
          </h1>

          <div className="row gap-4" style={{ alignItems: 'baseline' }}>
            <span
              className="price"
              style={{ fontSize: 36 }}
            >
              {formatCurrency(product.price)}
            </span>
            {product.list_price != null &&
              product.price != null &&
              product.list_price > product.price && (
                <>
                  <span className="price-strike" style={{ fontSize: 16 }}>
                    {formatCurrency(product.list_price)}
                  </span>
                  <span className="pill pill--ember">
                    Save {formatCurrency(product.list_price - product.price)}
                  </span>
                </>
              )}
          </div>

          <div className="row gap-4">
            <Rating stars={product.stars} count={product.review_count} size={16} />
            {avgVerifiedRatio != null && (
              <span className="muted" style={{ fontSize: 13 }}>
                · {Math.round(avgVerifiedRatio * 100)}% verified
              </span>
            )}
          </div>

          <div className="row gap-2" style={{ marginTop: 'var(--s-4)' }}>
            <button
              className={`btn ${inCart ? 'btn--ghost' : 'btn--emerald'} btn--lg`}
              onClick={() =>
                toggle({
                  asin: product.asin,
                  title: product.title,
                  price: product.price,
                  list_price: product.list_price,
                  stars: product.stars,
                  img_url: product.img_url,
                  category_name: product.category_name,
                  brand_name: product.brand_name
                })
              }
            >
              {inCart ? 'Remove from cart' : 'Add to cart'}
            </button>
            {product.product_url && (
              <a
                href={product.product_url}
                target="_blank"
                rel="noreferrer"
                className="btn btn--ghost btn--lg"
              >
                View on retailer ↗
              </a>
            )}
          </div>

          <div
            className="row gap-4 muted"
            style={{ fontSize: 12, fontFamily: 'var(--font-mono)', marginTop: 12 }}
          >
            <span>ASIN: {product.asin}</span>
          </div>
        </div>
      </section>

      <section className="grid" style={{ gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.2fr)', gap: 'var(--s-8)' }}>
        <div className="card">
          <div className="card-body">
            <div className="section-header" style={{ marginBottom: 'var(--s-4)' }}>
              <div className="title-block">
                <span className="eyebrow">Ratings</span>
                <h3 className="h-display h-display--md">Distribution</h3>
              </div>
              <div className="muted" style={{ fontSize: 13 }}>
                {formatCount(totalReviews)} reviews
              </div>
            </div>
            <BarChart
              data={(rating || [
                { rating: 1, review_count: 0 },
                { rating: 2, review_count: 0 },
                { rating: 3, review_count: 0 },
                { rating: 4, review_count: 0 },
                { rating: 5, review_count: 0 }
              ]).map((r) => ({
                label: `${r.rating}★`,
                value: r.review_count
              }))}
              valueFormat={(v) => formatCount(Math.round(v))}
              barColor="var(--emerald-600)"
              showValues={totalReviews > 0}
            />
            {totalReviews === 0 && (
              <div className="muted" style={{ fontSize: 13, marginTop: 12, textAlign: 'center' }}>
                This ASIN has no reviews in the loaded corpus (~12k reviews across 1.4M products).
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-body">
            <div className="section-header" style={{ marginBottom: 'var(--s-4)' }}>
              <div className="title-block">
                <span className="eyebrow">Reviews</span>
                <h3 className="h-display h-display--md">Most helpful</h3>
              </div>
            </div>
            {reviewsLoading ? (
              <div className="stack">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="skeleton" style={{ height: 80 }} />
                ))}
              </div>
            ) : (reviews || []).length === 0 ? (
              <Empty title="No reviews yet." />
            ) : (
              <div className="stack">
                {reviews.slice(0, 4).map((r) => (
                  <ReviewItem key={r.review_id} review={r} />
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      <section>
        <div className="section-header">
          <div className="title-block">
            <span className="eyebrow">Smarter picks</span>
            <h2 className="h-display h-display--lg">Higher rated and cheaper.</h2>
          </div>
        </div>
        {altLoading ? (
          <div className="grid grid-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="skeleton" style={{ height: 280, borderRadius: 'var(--r-lg)' }} />
            ))}
          </div>
        ) : (alternatives || []).length === 0 ? (
          <Empty
            title="This product is already the Pareto pick."
            description="No alternatives in the same category are both cheaper and higher rated."
          />
        ) : (
          <div className="grid grid-4 stagger">
            {alternatives.map((p) => (
              <ProductCard key={p.asin} product={p} badge={{ label: 'Better value', tone: 'emerald' }} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function ReviewItem({ review }) {
  return (
    <div
      style={{
        padding: 'var(--s-4)',
        border: '1px solid var(--line)',
        borderRadius: 'var(--r-md)',
        background: 'var(--surface-alt)'
      }}
    >
      <div className="row between" style={{ alignItems: 'flex-start', marginBottom: 6 }}>
        <div className="row gap-2">
          <span className="rating" style={{ fontWeight: 600 }}>
            <StarIcon size={14} />
            <span className="text-num">{formatStars(review.rating)}</span>
          </span>
          {review.verified_purchase && (
            <span className="pill pill--emerald" style={{ fontSize: 11 }}>
              Verified
            </span>
          )}
        </div>
        <span className="muted text-num" style={{ fontSize: 12 }}>
          {formatDate(review.review_timestamp)}
        </span>
      </div>
      {review.review_title && (
        <div style={{ fontWeight: 600, marginBottom: 4 }}>{review.review_title}</div>
      )}
      {review.review_text && (
        <p style={{ margin: 0, color: 'var(--ink-soft)', fontSize: 14 }}>
          {review.review_text.length > 260
            ? `${review.review_text.slice(0, 259)}…`
            : review.review_text}
        </p>
      )}
      <div
        className="row gap-4 muted"
        style={{ marginTop: 8, fontSize: 12 }}
      >
        <span>👍 {formatCount(review.helpful_vote || 0)} helpful</span>
        <span>
          Reviewer avg {formatStars(review.reviewer_avg_rating)} ·{' '}
          {formatCount(review.reviewer_total_reviews)} reviews
        </span>
      </div>
    </div>
  );
}

function ProductSkeleton() {
  return (
    <div className="container stack-lg">
      <div className="grid gap-8" style={{ gridTemplateColumns: '1.1fr 1fr' }}>
        <div className="skeleton" style={{ aspectRatio: '4 / 3', borderRadius: 'var(--r-lg)' }} />
        <div className="stack">
          <div className="skeleton" style={{ height: 16, width: '30%' }} />
          <div className="skeleton" style={{ height: 36, width: '90%' }} />
          <div className="skeleton" style={{ height: 36, width: '60%' }} />
          <div className="skeleton" style={{ height: 18, width: '40%' }} />
          <div className="skeleton" style={{ height: 48, width: '70%' }} />
        </div>
      </div>
    </div>
  );
}
