export default function StarIcon({ size = 14, filled = true, className = '' }) {
  return (
    <svg
      className={`rating-star ${className}`}
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={filled ? 0 : 1.5}
      aria-hidden="true"
    >
      <path d="M10 1.6l2.6 5.5 6 .7-4.4 4.2 1.2 6-5.4-3-5.4 3 1.2-6L1.4 7.8l6-.7z" />
    </svg>
  );
}
