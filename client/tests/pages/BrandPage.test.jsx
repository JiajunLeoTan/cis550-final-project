import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

const { api } = vi.hoisted(() => ({
  api: { brandProducts: vi.fn() }
}));

vi.mock('../../src/api/client.js', () => ({
  api,
  getQueryMode: () => 'old',
  setQueryMode: () => {},
  BASE_URL: 'http://test'
}));

import BrandPage from '../../src/pages/BrandPage.jsx';

function renderRoute(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/brand/:brandName" element={<BrandPage />} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  api.brandProducts.mockReset().mockResolvedValue([]);
});

describe('BrandPage', () => {
  it('queries with the brand from the URL', async () => {
    renderRoute('/brand/Aveeno');
    await waitFor(() => expect(api.brandProducts).toHaveBeenCalled());
    expect(api.brandProducts.mock.calls[0][0]).toMatchObject({
      brand: 'Aveeno',
      limit: 24,
      offset: 0
    });
  });

  it('renders product cards from the response', async () => {
    api.brandProducts.mockResolvedValueOnce([
      { asin: 'B0000A', title: 'Aveeno Cleanser', price: 8 }
    ]);
    renderRoute('/brand/Aveeno');
    expect(await screen.findByText('Aveeno Cleanser')).toBeInTheDocument();
  });

  it('renders the empty state when nothing comes back', async () => {
    renderRoute('/brand/Aveeno');
    expect(
      await screen.findByText(/No products found for this brand/i)
    ).toBeInTheDocument();
  });

  it('renders the error banner when the request fails', async () => {
    api.brandProducts.mockRejectedValueOnce(new Error('brand err'));
    renderRoute('/brand/Aveeno');
    expect(await screen.findByText('brand err')).toBeInTheDocument();
  });
});
