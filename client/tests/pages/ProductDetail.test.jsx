import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

const { api } = vi.hoisted(() => ({
  api: {
    product: vi.fn(),
    ratingDistribution: vi.fn(),
    helpfulReviews: vi.fn(),
    alternatives: vi.fn()
  }
}));

vi.mock('../../src/api/client.js', () => ({
  api,
  getQueryMode: () => 'standard',
  setQueryMode: () => {},
  BASE_URL: 'http://test'
}));

import ProductDetail from '../../src/pages/ProductDetail.jsx';
import { CartProvider } from '../../src/context/CartContext.jsx';

function renderRoute(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <CartProvider>
        <Routes>
          <Route path="/product/:asin" element={<ProductDetail />} />
        </Routes>
      </CartProvider>
    </MemoryRouter>
  );
}

const PRODUCT = {
  asin: 'B0719KWG8H',
  title: 'Aveeno Cleanser',
  price: 12,
  list_price: 18,
  stars: 4.4,
  review_count: 200,
  category_name: 'Beauty',
  brand_name: 'Aveeno',
  is_best_seller: true,
  product_url: 'https://example.com/p',
  img_url: 'https://example.com/p.jpg'
};

beforeEach(() => {
  api.product.mockReset().mockResolvedValue(PRODUCT);
  api.ratingDistribution.mockReset().mockResolvedValue([
    { rating: 5, review_count: 100, verified_ratio: 0.9 },
    { rating: 4, review_count: 50, verified_ratio: 0.8 }
  ]);
  api.helpfulReviews.mockReset().mockResolvedValue([
    {
      review_id: 1,
      rating: 5,
      review_title: 'Great',
      review_text: 'Loved it.',
      verified_purchase: true,
      review_timestamp: '2024-01-01',
      helpful_vote: 12,
      reviewer_avg_rating: 4.4,
      reviewer_total_reviews: 50
    }
  ]);
  api.alternatives.mockReset().mockResolvedValue([
    { asin: 'B07ALT0001', title: 'Cheaper Pick', price: 8, stars: 4.6, review_count: 80 }
  ]);
});

describe('ProductDetail', () => {
  it('renders skeleton while loading the product', () => {
    api.product.mockImplementation(() => new Promise(() => {}));
    const { container } = renderRoute(`/product/${PRODUCT.asin}`);
    expect(container.querySelectorAll('.skeleton').length).toBeGreaterThan(0);
  });

  it('shows the error banner when the product request fails', async () => {
    api.product.mockRejectedValueOnce(new Error('product down'));
    renderRoute(`/product/${PRODUCT.asin}`);
    expect(await screen.findByText('product down')).toBeInTheDocument();
  });

  it('shows not-found when the product is missing', async () => {
    api.product.mockResolvedValueOnce(null);
    renderRoute(`/product/${PRODUCT.asin}`);
    expect(await screen.findByText(/Product not found/)).toBeInTheDocument();
  });

  it('renders the product details, brand/category links, discount, and ASIN', async () => {
    renderRoute(`/product/${PRODUCT.asin}`);
    expect(await screen.findByRole('heading', { name: 'Aveeno Cleanser' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Aveeno' })).toHaveAttribute(
      'href',
      '/brand/Aveeno'
    );
    expect(screen.getByRole('link', { name: 'Beauty' })).toHaveAttribute(
      'href',
      '/category/Beauty'
    );
    expect(screen.getByText(/33% off/)).toBeInTheDocument();
    expect(screen.getByText('Best seller')).toBeInTheDocument();
    expect(screen.getByText(/ASIN: B0719KWG8H/)).toBeInTheDocument();
  });

  it('uses linked review counts when catalog review_count is zero', async () => {
    api.product.mockResolvedValueOnce({
      ...PRODUCT,
      asin: 'B00290G0LW',
      stars: 4.3,
      review_count: 0
    });
    api.ratingDistribution.mockResolvedValueOnce([
      { rating: 1, review_count: 10, verified_ratio: 0.4 },
      { rating: 2, review_count: 5, verified_ratio: 0.4 },
      { rating: 3, review_count: 17, verified_ratio: 0.5 },
      { rating: 4, review_count: 24, verified_ratio: 0.6 },
      { rating: 5, review_count: 95, verified_ratio: 0.8 }
    ]);

    renderRoute('/product/B00290G0LW');

    expect(await screen.findByRole('heading', { name: 'Aveeno Cleanser' })).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByText('No ratings yet')).not.toBeInTheDocument();
    });
    expect(screen.getByText('4.3')).toBeInTheDocument();
    expect(screen.getAllByText(/151/).length).toBeGreaterThan(0);
  });

  it('treats a zero product price as unavailable', async () => {
    api.product.mockResolvedValueOnce({ ...PRODUCT, price: 0 });
    renderRoute(`/product/${PRODUCT.asin}`);
    expect(await screen.findByText('Price unavailable')).toBeInTheDocument();
    expect(screen.queryByText(/\$0\.00/)).toBeNull();
    expect(screen.queryByText(/33% off/)).toBeNull();
  });

  it('renders helpful reviews when present', async () => {
    renderRoute(`/product/${PRODUCT.asin}`);
    expect(await screen.findByText('Great')).toBeInTheDocument();
    expect(screen.getByText('Loved it.')).toBeInTheDocument();
    expect(screen.getByText(/Verified purchase/)).toBeInTheDocument();
  });

  it('renders alternatives when present', async () => {
    renderRoute(`/product/${PRODUCT.asin}`);
    expect(await screen.findByText('Cheaper Pick')).toBeInTheDocument();
    expect(screen.getByText('Better value')).toBeInTheDocument();
  });

  it('renders empty states for reviews and alternatives', async () => {
    api.helpfulReviews.mockResolvedValueOnce([]);
    api.alternatives.mockResolvedValueOnce([]);
    renderRoute(`/product/${PRODUCT.asin}`);
    expect(await screen.findByText('No reviews yet.')).toBeInTheDocument();
    expect(
      await screen.findByText('No cheaper alternatives in this category.')
    ).toBeInTheDocument();
  });

  it('toggles the product in and out of the cart', async () => {
    renderRoute(`/product/${PRODUCT.asin}`);
    const addBtn = await screen.findByRole('button', { name: 'Add to cart' });
    await userEvent.click(addBtn);
    expect(
      await screen.findByRole('button', { name: 'Remove from cart' })
    ).toBeInTheDocument();
  });
});
