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

  const showBadge = badge ?? (is_best_seller ? { label: 'Best seller', tone: 'gold' } : null);

  return (
    <Link to={`/product/${encodeURIComponent(asin)}`} className="card card-hover product-card">
      <div className="product-media">
        {img_url ? (
          <img src={img_url} alt="" loading="lazy" />
        ) : (
          <span>{initials(title)}</span>
        )}
        {showBadge && (
          <span
            className={`pill pill--${showBadge.tone || 'emerald'}`}
            style={{
              position: 'absolute',
              top: 12,
              left: 12,
              backdropFilter: 'blur(6px)',
              background: 'rgba(255, 253, 245, 0.9)'
            }}
          >
            {showBadge.label}
          </span>
        )}
      </div>
      <div className="product-card-body">
        <div className="row row-wrap gap-2" style={{ marginBottom: 2 }}>
          {category_name && <span className="eyebrow" style={{ fontSize: 11 }}>{category_name}</span>}
        </div>
        <div className="product-title">{title || 'Untitled product'}</div>
        {brand_name && <div className="muted" style={{ fontSize: 13 }}>{brand_name}</div>}
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
