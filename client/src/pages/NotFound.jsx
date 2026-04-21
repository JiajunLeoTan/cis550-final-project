import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="container">
      <div className="empty">
        <h3>404 — not found</h3>
        <p>That page went looking for another URL.</p>
        <div style={{ marginTop: 16 }}>
          <Link to="/" className="btn btn--emerald">
            Back home
          </Link>
        </div>
      </div>
    </div>
  );
}
