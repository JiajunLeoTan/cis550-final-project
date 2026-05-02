import { Link } from 'react-router-dom';
import Rating from './Rating.jsx';
import { formatCurrency } from '../utils/format.js';

function initials(title = '') {
  return title
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
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
  const badgeClass =
    showBadge?.tone === 'positive' || showBadge?.tone === 'discount'
      ? 'product-badge product-badge--positive'
      : 'product-badge';

  return (
    <Link to={`/product/${encodeURIComponent(asin)}`} className="card card-hover product-card">
      <div className="product-media">
        {img_url ? (
          <img src={img_url} alt="" loading="lazy" />
        ) : (
          <span>{initials(title)}</span>
        )}
      </div>
      <div className="product-card-body">
        {meta && <div className="product-meta-line">{meta}</div>}
        <div className="product-title">{title || 'Untitled product'}</div>
        {showBadge && <div className={badgeClass}>{showBadge.label}</div>}
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
