import { NavLink, Link } from 'react-router-dom';
import { useCart } from '../context/CartContext.jsx';

export default function Header() {
  const { count } = useCart();
  return (
    <header className="site-header">
      <div className="container nav">
        <Link to="/" className="brand" aria-label="Axiom home">
          <span>Axiom</span>
        </Link>
        <nav className="nav-links" aria-label="Primary">
          <NavLink to="/browse" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
            Browse
          </NavLink>
          <NavLink
            to="/analytics"
            className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
          >
            Analytics
          </NavLink>
          <NavLink
            to="/value"
            className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
          >
            Value rankings
          </NavLink>
          <NavLink
            to="/cart"
            className={({ isActive }) => `nav-cart${isActive ? ' active' : ''}`}
            aria-label={`Cart with ${count} items`}
          >
            Cart
            {count > 0 && <span className="nav-cart-count">{count}</span>}
          </NavLink>
        </nav>
      </div>
    </header>
  );
}
