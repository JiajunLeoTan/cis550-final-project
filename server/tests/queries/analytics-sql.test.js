import { describe, it, expect } from 'vitest';
import {
  categoriesCompareQuery,
  brandsPerformanceQuery,
  brandsPerformanceQueryOptimized,
  reviewsTrendQuery
} from '../../queries/analytics.sql.js';

describe('analytics SQL regressions', () => {
  it('category price averages ignore non-positive product prices', () => {
    expect(categoriesCompareQuery).toMatch(
      /\(AVG\(p\.price\)\s+FILTER\s+\(WHERE p\.price > 0\)\)::float AS avg_price/i
    );
  });

  it('brand performance qualifies brands by all linked reviews', () => {
    expect(brandsPerformanceQuery).not.toMatch(/WHERE[\s\S]*AND r\.verified_purchase\s*=\s*TRUE/i);
    expect(brandsPerformanceQuery).toMatch(
      /COUNT\(\*\)\s+FILTER\s*\(WHERE r\.verified_purchase = TRUE\)/i
    );
    expect(brandsPerformanceQuery).toMatch(/verified_review_count/i);
    expect(brandsPerformanceQueryOptimized).toMatch(/verified_review_count/i);
  });

  it('review trend uses reviewer activity for credibility groups', () => {
    expect(reviewsTrendQuery).toMatch(/reviewer_counts/i);
    expect(reviewsTrendQuery).toMatch(/rc\.total_reviews\s*>=\s*10/i);
    expect(reviewsTrendQuery).not.toMatch(/WHEN r\.verified_purchase THEN 'high'/i);
    expect(reviewsTrendQuery).toMatch(/verified_count/i);
  });
});
