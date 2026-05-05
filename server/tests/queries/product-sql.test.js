import { describe, it, expect } from 'vitest';
import { topValueProductsQueryOptimized } from '../../queries/products/index.js';

describe('product SQL regressions', () => {
  it('optimized top-value honors reviewedSince with the materialized timestamp', () => {
    expect(topValueProductsQueryOptimized).toMatch(
      /m\.latest_review_timestamp\s*>=\s*\$1::timestamp/i
    );
    expect(topValueProductsQueryOptimized).not.toMatch(/\$1::timestamp IS NOT NULL/i);
  });
});
