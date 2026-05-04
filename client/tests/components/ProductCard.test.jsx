import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import ProductCard from '../../src/components/ProductCard.jsx';
import { renderWith } from '../test-utils.jsx';

const FULL_PRODUCT = {
  asin: 'B0719KWG8H',
  title: 'Aveeno Daily Cleanser',
  price: 12.5,
  list_price: 18,
  stars: 4.4,
  review_count: 234,
  img_url: 'https://example.com/cleanser.jpg',
  category_name: 'Skin Care',
  brand_name: 'Aveeno'
};

describe('ProductCard', () => {
  it('returns null when no product is provided', () => {
    const { container } = renderWith(<ProductCard product={null} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders title, brand, category, price, and link target', () => {
    renderWith(<ProductCard product={FULL_PRODUCT} />);
    expect(screen.getByText('Aveeno Daily Cleanser')).toBeInTheDocument();
    expect(screen.getByText(/Aveeno · Skin Care/)).toBeInTheDocument();
    expect(screen.getByText('$12.50')).toBeInTheDocument();
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/product/B0719KWG8H');
  });

  it('renders the strike-through list price when discounted', () => {
    renderWith(<ProductCard product={FULL_PRODUCT} />);
    expect(screen.getByText('$18.00')).toBeInTheDocument();
  });

  it('renders an explicit positive-toned badge as a discount overlay', () => {
    renderWith(
      <ProductCard
        product={FULL_PRODUCT}
        badge={{ label: '20% off', tone: 'positive' }}
      />
    );
    expect(screen.getByText('20% off')).toBeInTheDocument();
  });

  it('renders an editorial badge as eyebrow text', () => {
    renderWith(<ProductCard product={FULL_PRODUCT} badge={{ label: 'Proven' }} />);
    expect(screen.getByText('Proven')).toBeInTheDocument();
  });

  it('falls back to a serif monogram when img_url is missing', () => {
    const noImg = { ...FULL_PRODUCT, img_url: null };
    renderWith(<ProductCard product={noImg} />);
    expect(screen.getByText('Av')).toBeInTheDocument();
  });

  it('renders is_best_seller as the default badge', () => {
    renderWith(
      <ProductCard product={{ ...FULL_PRODUCT, is_best_seller: true }} />
    );
    expect(screen.getByText('Best seller')).toBeInTheDocument();
  });

  it('falls back to "Untitled product" when title is missing', () => {
    renderWith(<ProductCard product={{ asin: 'B07ZZZZZZZ' }} />);
    expect(screen.getByText('Untitled product')).toBeInTheDocument();
  });
});
