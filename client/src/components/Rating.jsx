import StarIcon from './StarIcon.jsx';
import { formatCount, formatStars } from '../utils/format.js';

export default function Rating({ stars, count, size = 14 }) {
  const numericCount = Number(count);
  if (stars == null || count == null || Number.isNaN(numericCount) || numericCount <= 0) {
    return <span className="rating muted">No ratings yet</span>;
  }
  return (
    <span className="rating">
      <StarIcon size={size} />
      <span>{formatStars(stars)}</span>
      <span className="rating-count"> · {formatCount(numericCount)}</span>
    </span>
  );
}
