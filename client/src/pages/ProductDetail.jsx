import { Link, useParams } from 'react-router-dom';
import { api } from '../api/client.js';
import { useApi } from '../api/useApi.js';
import { useCart } from '../context/CartContext.jsx';
import Rating from '../components/Rating.jsx';
import StarIcon from '../components/StarIcon.jsx';
import ProductCard from '../components/ProductCard.jsx';
import { Empty, ErrorBanner } from '../components/States.jsx';
import BarChart from '../components/charts/BarChart.jsx';
import {
  formatCount,
  formatCurrency,
  formatDate,
  formatProductPrice,
  formatStars,
  isValidPrice
} from '../utils/format.js';

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
  const hasPrice = isValidPrice(product.price);
  const hasListPrice = isValidPrice(product.list_price);
  const hasDiscount = hasPrice && hasListPrice && product.list_price > product.price;
  const discountPct = hasDiscount
    ? Math.round((1 - product.price / product.list_price) * 100)
    : null;
  return (
    <div className="container stack-lg">
      <div style={{ fontFamily: 'var(--font-sans)', fontSize: 13 }}>
        <Link to="/browse" className="muted">
          Back to browse
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
            background: 'var(--paper-2)'
          }}
        >
          {product.img_url ? (
            <img
              src={product.img_url}
              alt={product.title}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <span className="muted" style={{ fontFamily: 'var(--font-sans)', fontSize: 13 }}>
              No image
            </span>
          )}
        </div>

        <div className="stack">
          {(product.brand_name || product.category_name || product.is_best_seller) && (
            <div className="meta-line product-detail-meta">
              {product.brand_name && (
                <Link
                  to={`/brand/${encodeURIComponent(product.brand_name)}`}
                  className="product-detail-category-link"
                >
                  {product.brand_name}
                </Link>
              )}
              {product.category_name && (
                <Link
                  to={`/category/${encodeURIComponent(product.category_name)}`}
                  className="product-detail-category-link"
                >
                  {product.category_name}
                </Link>
              )}
              {product.is_best_seller && (
                <span style={{ color: 'var(--ink)' }}>Best seller</span>
              )}
            </div>
          )}

          <h1 className="page-title" style={{ fontSize: 'clamp(30px, 4vw, 44px)' }}>
            {product.title}
          </h1>

          <div className="price" style={{ fontSize: 32 }}>
            {formatProductPrice(product.price)}
            {hasDiscount && (
              <span style={{ color: 'var(--ink-3)', fontSize: 18 }}>
                {' '}
                - was {formatCurrency(product.list_price)}{' '}
                <span className="discount">({discountPct}% off)</span>
              </span>
            )}
          </div>

          <div className="row gap-4">
            <Rating stars={product.stars} count={product.review_count} size={16} />
            {avgVerifiedRatio != null && (
              <span className="meta-line">
                {Math.round(avgVerifiedRatio * 100)}% verified
              </span>
            )}
          </div>

          <div className="row gap-2" style={{ marginTop: 'var(--s-4)' }}>
            <button
              className={`btn ${inCart ? 'btn--quiet' : ''} btn--lg`}
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
                className="btn btn--quiet btn--lg"
              >
                View on retailer
              </a>
            )}
          </div>

          <div className="meta-line" style={{ marginTop: 12 }}>
            ASIN: {product.asin}
          </div>
        </div>
      </section>

      <section
        className="grid"
        style={{ gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.2fr)', gap: 'var(--s-8)' }}
      >
        <div className="card">
          <div className="card-body">
            <div className="row between" style={{ alignItems: 'baseline', marginBottom: 'var(--s-4)' }}>
              <h2 className="small-heading">Ratings distribution</h2>
              <div className="meta-line">{formatCount(totalReviews)} reviews</div>
            </div>
            <BarChart
              data={(rating || [
                { rating: 1, review_count: 0 },
                { rating: 2, review_count: 0 },
                { rating: 3, review_count: 0 },
                { rating: 4, review_count: 0 },
                { rating: 5, review_count: 0 }
              ]).map((r) => ({
                label: `${r.rating} star`,
                value: r.review_count
              }))}
              valueFormat={(v) => formatCount(Math.round(v))}
              showValues={totalReviews > 0}
            />
            {totalReviews === 0 && (
              <div className="meta-line" style={{ marginTop: 12, textAlign: 'center' }}>
                This ASIN has no reviews in the loaded corpus.
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-body">
            <h2 className="small-heading" style={{ marginBottom: 'var(--s-4)' }}>
              Most helpful reviews
            </h2>
            {reviewsLoading ? (
              <div className="stack">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="skeleton" style={{ height: 80 }} />
                ))}
              </div>
            ) : (reviews || []).length === 0 ? (
              <Empty title="No reviews yet." />
            ) : (
              <div className="plain-list">
                {reviews.slice(0, 4).map((r) => (
                  <ReviewItem key={r.review_id} review={r} />
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      <section>
        <header className="section-header">
          <h2 className="section-title">Cheaper alternatives</h2>
        </header>
        {altLoading ? (
          <div className="grid grid-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="skeleton" style={{ height: 280, borderRadius: 'var(--r-lg)' }} />
            ))}
          </div>
        ) : (alternatives || []).length === 0 ? (
          <Empty title="No cheaper alternatives in this category." />
        ) : (
          <div className="grid grid-4">
            {alternatives.map((p) => (
              <ProductCard key={p.asin} product={p} badge={{ label: 'Better value' }} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function ReviewItem({ review }) {
  return (
    <article className="review-item">
      <div className="row between" style={{ alignItems: 'flex-start', marginBottom: 6 }}>
        <div className="row gap-2 meta-line">
          <span className="rating" style={{ fontWeight: 600 }}>
            <StarIcon size={14} />
            <span>{formatStars(review.rating)}</span>
          </span>
          {review.verified_purchase && <span>Verified purchase</span>}
        </div>
        <span className="meta-line">{formatDate(review.review_timestamp)}</span>
      </div>
      {review.review_title && (
        <div style={{ color: 'var(--ink)', fontWeight: 600, marginBottom: 4 }}>
          {review.review_title}
        </div>
      )}
      {review.review_text && (
        <p style={{ margin: 0, color: 'var(--ink-2)' }}>
          {review.review_text.length > 260
            ? `${review.review_text.slice(0, 259)}...`
            : review.review_text}
        </p>
      )}
      <div className="meta-line" style={{ marginTop: 8 }}>
        {formatCount(review.helpful_vote || 0)} found this helpful
        {review.reviewer_total_reviews != null && (
          <>
            {' '}
            · Reviewer avg {formatStars(review.reviewer_avg_rating)} ·{' '}
            {formatCount(review.reviewer_total_reviews)} reviews
          </>
        )}
      </div>
    </article>
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
