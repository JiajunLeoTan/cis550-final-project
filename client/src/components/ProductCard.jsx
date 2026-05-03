import { Link } from 'react-router-dom';
import Rating from './Rating.jsx';
import { formatCurrency } from '../utils/format.js';

function monogram(title = '') {
  const first = title.trim().split(/\s+/).filter(Boolean)[0] || '';
  return (first[0] || '').toUpperCase() + (first[1] || '').toLowerCase();
}

export default function ProductCard({ product, badge }) {
  if (!product) return null;
  const {
    asin,
    title,
    price,
    list_price,
    stars,
    review_count,
    img_url,
    category_name,
    brand_name,
    is_best_seller
  } = product;

  const meta = [brand_name, category_name].filter(Boolean).join(' · ');
  const showBadge = badge ?? (is_best_seller ? { label: 'Best seller' } : null);
  const isPriceTag =
    showBadge && (showBadge.tone === 'positive' || showBadge.tone === 'discount');

  return (
    <Link to={`/product/${encodeURIComponent(asin)}`} className="card card-hover product-card">
      <div className="product-media">
        {isPriceTag && <span className="product-discount-tag">{showBadge.label}</span>}
        {img_url ? (
          <img src={img_url} alt="" loading="lazy" />
        ) : (
          <span className="product-monogram">{monogram(title)}</span>
        )}
      </div>
      <div className="product-card-body">
        {meta && <div className="product-meta-line">{meta}</div>}
        {showBadge && !isPriceTag && (
          <div className="product-eyebrow">{showBadge.label}</div>
        )}
        <div className="product-title">{title || 'Untitled product'}</div>
        <div className="product-meta">
          <div>
            <span className="price price--sm">{formatCurrency(price)}</span>
            {list_price != null && price != null && list_price > price && (
              <span className="price-strike">{formatCurrency(list_price)}</span>
            )}
          </div>
          <Rating stars={stars} count={review_count} />
        </div>
      </div>
    </Link>
  );
}
