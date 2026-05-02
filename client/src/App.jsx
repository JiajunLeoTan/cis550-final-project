import { Routes, Route } from 'react-router-dom';
import Header from './components/Header.jsx';
import Footer from './components/Footer.jsx';
import Home from './pages/Home.jsx';
import Browse from './pages/Browse.jsx';
import CategoryPage from './pages/CategoryPage.jsx';
import BrandPage from './pages/BrandPage.jsx';
import ProductDetail from './pages/ProductDetail.jsx';
import Cart from './pages/Cart.jsx';
import Analytics from './pages/Analytics.jsx';
import ValueRankings from './pages/ValueRankings.jsx';
import NotFound from './pages/NotFound.jsx';

export default function App() {
  return (
    <div className="app">
      <Header />
      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/browse" element={<Browse />} />
          <Route path="/category/:categoryName" element={<CategoryPage />} />
          <Route path="/brand/:brandName" element={<BrandPage />} />
          <Route path="/product/:asin" element={<ProductDetail />} />
          <Route path="/cart" element={<Cart />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/value" element={<ValueRankings />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <Footer />
    </div>
  );
}
