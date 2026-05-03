import QueryModeToggle from './QueryModeToggle.jsx';

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="container">
        <div className="footer-mark">
          <span className="kicker">Colophon</span>
          <div className="footer-mark-row">
            <span className="footer-brand">Axiom</span>
            <span className="footer-tag">
              A catalog of beauty &middot; product research over 1.4M items.
            </span>
          </div>
        </div>
        <div className="footer-inner">
          <span>CIS 550 &middot; Data served from AWS RDS</span>
          <div className="query-toggle-wrap">
            <span className="query-toggle-label">SQL mode:</span>
            <QueryModeToggle />
          </div>
        </div>
      </div>
    </footer>
  );
}
