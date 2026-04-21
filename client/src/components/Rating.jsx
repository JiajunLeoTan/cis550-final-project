import StarIcon from './StarIcon.jsx';
import { formatCount, formatStars } from '../utils/format.js';

export default function Rating({ stars, count, size = 14 }) {
  if (stars == null) {
    return <span className="rating muted">No ratings yet</span>;
  }
  return (
    <span className="rating">
      <StarIcon size={size} />
      <span className="text-num">{formatStars(stars)}</span>
      {count != null && <span className="muted"> · {formatCount(count)}</span>}
    </span>
  );
}
