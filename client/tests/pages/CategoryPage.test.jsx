import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

const { api } = vi.hoisted(() => ({
  api: {
    categories: vi.fn(),
    categoryProducts: vi.fn()
  }
}));

vi.mock('../../src/api/client.js', () => ({
  api,
  getQueryMode: () => 'old',
  setQueryMode: () => {},
  BASE_URL: 'http://test'
}));

import CategoryPage from '../../src/pages/CategoryPage.jsx';

function renderRoute(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/category/:categoryName" element={<CategoryPage />} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  api.categories.mockReset().mockResolvedValue([
    { category_id: 1, category_name: 'Beauty' }
  ]);
  api.categoryProducts.mockReset().mockResolvedValue([]);
});

describe('CategoryPage', () => {
  it('passes the category from the URL into the products query', async () => {
    renderRoute('/category/Beauty');
    await waitFor(() => expect(api.categoryProducts).toHaveBeenCalled());
    expect(api.categoryProducts.mock.calls[0][0]).toMatchObject({
      category: 'Beauty',
      limit: 24,
      offset: 0
    });
  });

  it('renders product cards from the response', async () => {
    api.categoryProducts.mockResolvedValueOnce([
      { asin: 'B0000A', title: 'Cleanser A', price: 8 },
      { asin: 'B0000B', title: 'Cleanser B', price: 9 }
    ]);
    renderRoute('/category/Beauty');
    expect(await screen.findByText('Cleanser A')).toBeInTheDocument();
    expect(await screen.findByText('Cleanser B')).toBeInTheDocument();
  });

  it('renders an empty state when no products come back', async () => {
    renderRoute('/category/Beauty');
    expect(
      await screen.findByText(/No products found for this category/i)
    ).toBeInTheDocument();
  });

  it('renders the error banner when the request fails', async () => {
    api.categoryProducts.mockRejectedValueOnce(new Error('cat err'));
    renderRoute('/category/Beauty');
    expect(await screen.findByText('cat err')).toBeInTheDocument();
  });
});
