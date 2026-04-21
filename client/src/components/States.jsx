export function SkeletonCard() {
  return (
    <div className="card">
      <div className="skeleton" style={{ aspectRatio: '4 / 3', borderRadius: 0 }} />
      <div className="product-card-body">
        <div className="skeleton" style={{ height: 10, width: '40%' }} />
        <div className="skeleton" style={{ height: 14, width: '90%', marginTop: 10 }} />
        <div className="skeleton" style={{ height: 14, width: '60%', marginTop: 6 }} />
        <div className="row between" style={{ marginTop: 16 }}>
          <div className="skeleton" style={{ height: 18, width: 60 }} />
          <div className="skeleton" style={{ height: 14, width: 60 }} />
        </div>
      </div>
    </div>
  );
}

export function SkeletonGrid({ count = 8 }) {
  return (
    <div className="grid grid-4">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}

export function Empty({ title = 'Nothing here yet', description, action }) {
  return (
    <div className="empty">
      <h3>{title}</h3>
      {description && <p style={{ maxWidth: 420, margin: '0 auto' }}>{description}</p>}
      {action && <div style={{ marginTop: 16 }}>{action}</div>}
    </div>
  );
}

export function ErrorBanner({ error, onRetry }) {
  if (!error) return null;
  return (
    <div className="error row between" style={{ alignItems: 'center' }}>
      <span>Something went wrong: {error.message || 'unknown error'}</span>
      {onRetry && (
        <button className="btn btn--ghost btn--sm" onClick={onRetry}>
          Retry
        </button>
      )}
    </div>
  );
}
