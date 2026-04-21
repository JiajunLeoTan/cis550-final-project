import { NavLink, Link } from 'react-router-dom';
import { useCart } from '../context/CartContext.jsx';

export default function Header() {
  const { count } = useCart();
  return (
    <header className="site-header">
      <div className="container nav">
        <Link to="/" className="brand" aria-label="Axiom home">
          <span className="brand-mark">A</span>
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
            Value Rankings
          </NavLink>
          <Link to="/cart" className="nav-cart" aria-label={`Cart with ${count} items`}>
            <span>Cart</span>
            <span className="nav-cart-badge text-num">{count}</span>
          </Link>
        </nav>
      </div>
    </header>
  );
}
