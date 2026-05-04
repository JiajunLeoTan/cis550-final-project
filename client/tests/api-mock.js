import { vi } from 'vitest';

export function makeApiMock() {
  return {
    categories: vi.fn().mockResolvedValue([]),
    brands: vi.fn().mockResolvedValue([]),
    product: vi.fn().mockResolvedValue(null),
    searchProducts: vi.fn().mockResolvedValue([]),
    deals: vi.fn().mockResolvedValue([]),
    categoryProducts: vi.fn().mockResolvedValue([]),
    brandProducts: vi.fn().mockResolvedValue([]),
    ratingDistribution: vi.fn().mockResolvedValue([]),
    helpfulReviews: vi.fn().mockResolvedValue([]),
    alternatives: vi.fn().mockResolvedValue([]),
    trending: vi.fn().mockResolvedValue([]),
    topValue: vi.fn().mockResolvedValue([]),
    valueRankings: vi.fn().mockResolvedValue([]),
    cartSavings: vi.fn().mockResolvedValue({ items: 0, current_total: 0, list_total: 0, savings: 0 }),
    categoriesCompare: vi.fn().mockResolvedValue([]),
    brandsPerformance: vi.fn().mockResolvedValue([]),
    reviewsTrend: vi.fn().mockResolvedValue([])
  };
}
