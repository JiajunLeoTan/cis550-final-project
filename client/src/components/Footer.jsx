import QueryModeToggle from './QueryModeToggle.jsx';

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="container footer-inner">
        <div>
          <span className="footer-brand">Axiom</span> · Product research over 1.4M items
        </div>
        <div className="footer-right">
          <span>CIS 550 · Data served from AWS RDS</span>
          <div className="query-toggle-wrap">
            <span className="query-toggle-label">SQL mode:</span>
            <QueryModeToggle />
          </div>
        </div>
      </div>
    </footer>
  );
}
