import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  alternativesQuery,
  alternativesQueryOptimized,
  brandProductsQuery,
  brandProductsQueryOptimized,
  categoryProductsQuery,
  categoryProductsQueryOptimized,
  dealsQuery,
  dealsQueryOptimized,
  searchProductsQuery,
  searchProductsQueryOptimized,
  topValueProductsQuery,
  topValueProductsQueryOptimized,
  trendingProductsDefaultQuery,
  trendingProductsQuery,
  trendingProductsQueryOptimized,
  valueRankingsQuery,
  valueRankingsQueryOptimized
} from '../../queries/products/index.js';

const perfDdl = readFileSync(new URL('../../../database/perf_ddl.sql', import.meta.url), 'utf8');
const schemaDdl = readFileSync(new URL('../../../database/schema.sql', import.meta.url), 'utf8');

describe('product SQL regressions', () => {
  it('deals queries use identical raw-discount ordering with a stable tie-breaker', () => {
    const order = /ORDER BY \(1 - p\.price \/ p\.list_price\) DESC, p\.review_count DESC, p\.stars DESC NULLS LAST, p\.asin ASC/i;
    expect(dealsQuery).toMatch(order);
    expect(dealsQueryOptimized).toMatch(order);
    expect(dealsQuery).not.toMatch(/ORDER BY discount_pct/i);
  });

  it('price-sensitive product queries ignore non-positive product prices', () => {
    for (const sql of [dealsQuery, dealsQueryOptimized]) {
      expect(sql).toMatch(/p\.price\s+IS\s+NOT\s+NULL/i);
      expect(sql).toMatch(/p\.price\s*>\s*0/i);
      expect(sql).toMatch(/p\.list_price\s*>\s*0/i);
    }

    for (const sql of [
      categoryProductsQuery,
      categoryProductsQueryOptimized,
      brandProductsQuery,
      brandProductsQueryOptimized
    ]) {
      expect(sql).toMatch(/p\.price\s+IS\s+NOT\s+NULL\s+AND\s+p\.price\s*>\s*0\s+AND\s+p\.price\s*<=\s*\$3/i);
      expect(sql).toMatch(/(?:p|pp)\.price\s*<\s*(?:p|pp)\.list_price/i);
    }
  });

  it('positive minimum-rating filters require at least one product review', () => {
    for (const sql of [
      searchProductsQuery,
      searchProductsQueryOptimized
    ]) {
      expect(sql).toMatch(/COALESCE\(stars,\s*0\)\s*>=\s*\$2/i);
      expect(sql).toMatch(/\$2\s*=\s*0\s+OR\s+COALESCE\(review_count,\s*0\)\s*>\s*0/i);
    }

    for (const sql of [
      dealsQuery,
      dealsQueryOptimized,
      categoryProductsQuery,
      categoryProductsQueryOptimized,
      brandProductsQuery,
      brandProductsQueryOptimized
    ]) {
      expect(sql).toMatch(/COALESCE\(p\.stars,\s*0\)\s*>=\s*\$2/i);
      expect(sql).toMatch(/\$2\s*=\s*0\s+OR\s+COALESCE\(p\.review_count,\s*0\)\s*>\s*0/i);
    }
  });

  it('trending separates explicit month windows from the dataset-relative default', () => {
    expect(trendingProductsQuery).toMatch(
      /review_timestamp\s*>=\s*NOW\(\)\s*-\s*\(\$2::text \|\| ' months'\)::interval/i
    );
    expect(trendingProductsDefaultQuery).toMatch(/review_horizon AS/i);
    expect(trendingProductsDefaultQuery).toMatch(
      /COALESCE\(MAX\(review_timestamp\), NOW\(\)\)\s*-\s*INTERVAL '12 months'/i
    );
    expect(trendingProductsDefaultQuery).toMatch(/p\.asin ASC/i);
    expect(trendingProductsQueryOptimized).not.toMatch(/\$2::int/i);
    expect(trendingProductsQueryOptimized).toMatch(/m\.asin ASC/i);
  });

  it('optimized top-value honors reviewedSince with the materialized timestamp', () => {
    expect(topValueProductsQueryOptimized).toMatch(
      /m\.latest_review_timestamp\s*>=\s*\$1::timestamp/i
    );
    expect(topValueProductsQueryOptimized).not.toMatch(/\$1::timestamp IS NOT NULL/i);
    expect(topValueProductsQueryOptimized).not.toMatch(/m\.recent_review_count\s*>\s*0/i);
  });

  it('top-value and value-ranking queries exclude non-positive prices from scoring', () => {
    expect(topValueProductsQuery).toMatch(/p\.price\s+IS\s+NOT\s+NULL\s+AND\s+p\.price\s*>\s*0/i);
    expect(topValueProductsQuery).toMatch(/p2\.price\s+IS\s+NOT\s+NULL\s+AND\s+p2\.price\s*>\s*0/i);
    expect(topValueProductsQueryOptimized).toMatch(/m\.price\s*>\s*0/i);
    expect(topValueProductsQueryOptimized).toMatch(/m\.cat_avg_price\s*>\s*0/i);

    expect(valueRankingsQuery).toMatch(/WHERE price IS NOT NULL\s+AND price > 0\s+AND stars IS NOT NULL/i);
    expect(valueRankingsQuery).toMatch(/WHERE p\.price IS NOT NULL\s+AND p\.price > 0\s+AND p\.stars IS NOT NULL/i);
    expect(valueRankingsQueryOptimized).toMatch(/AND m\.price\s*>\s*0/i);
  });

  it('live value rankings use the same dataset-relative recency window as the MV', () => {
    expect(valueRankingsQuery).toMatch(/review_horizon AS/i);
    expect(valueRankingsQuery).toMatch(
      /COALESCE\(MAX\(review_timestamp\), NOW\(\)\)\s*-\s*INTERVAL '12 months'/i
    );
    expect(valueRankingsQuery).toMatch(/r\.review_timestamp\s*>=\s*h\.start_at/i);
    expect(valueRankingsQuery).not.toMatch(/NOW\(\)\s*-\s*INTERVAL '3 months'/i);
  });

  it('value rankings include a stable ASIN tie-breaker', () => {
    expect(valueRankingsQuery).toMatch(
      /ORDER BY value_score DESC NULLS LAST, p\.stars DESC NULLS LAST, p\.review_count DESC, p\.asin ASC/i
    );
    expect(valueRankingsQueryOptimized).toMatch(
      /ORDER BY ranked\.value_score DESC NULLS LAST, p\.stars DESC NULLS LAST, p\.review_count DESC, ranked\.asin ASC/i
    );
  });

  it('top-value queries include a stable ASIN tie-breaker', () => {
    expect(topValueProductsQuery).toMatch(
      /ORDER BY p\.stars DESC NULLS LAST, p\.review_count DESC, p\.price ASC NULLS LAST, p\.asin ASC/i
    );
    expect(topValueProductsQueryOptimized).toMatch(
      /ORDER BY m\.stars DESC NULLS LAST, m\.review_count DESC, m\.price ASC NULLS LAST, m\.asin ASC/i
    );
  });

  it('alternatives fall back to cheaper products when the target rating is unreliable', () => {
    for (const sql of [alternativesQuery, alternativesQueryOptimized]) {
      expect(sql).toMatch(/COALESCE\(t\.review_count,\s*0\)\s*>\s*0/i);
      expect(sql).toMatch(/p\.stars\s*>\s*t\.stars/i);
      expect(sql).toMatch(/OR\s+t\.stars\s+IS\s+NULL/i);
      expect(sql).toMatch(/OR\s+COALESCE\(t\.review_count,\s*0\)\s*<=\s*0/i);
      expect(sql).toMatch(/t\.price\s*>\s*0/i);
      expect(sql).toMatch(/p\.price\s*>\s*0/i);
      expect(sql).toMatch(/p\.price\s+ASC\s+NULLS\s+LAST/i);
      expect(sql).toMatch(/p\.asin\s+ASC/i);
    }
  });

  it('value-component DDL separates recent review count from all-time latest review timestamp', () => {
    for (const ddl of [perfDdl, schemaDdl]) {
      expect(ddl).toMatch(/recent_reviews AS/i);
      expect(ddl).toMatch(/latest_reviews AS[\s\S]*MAX\(review_timestamp\) AS latest_review_timestamp/i);
      expect(ddl).toMatch(/LEFT JOIN latest_reviews lr ON lr\.asin = p\.asin/i);
      expect(ddl).toMatch(/WHERE latest_review_timestamp IS NOT NULL/i);
      expect(ddl).not.toMatch(/WHERE recent_review_count > 0/i);
      expect(ddl).toMatch(
        /idx_mv_value_components_trending[\s\S]*review_count DESC,\s*asin ASC/i
      );
    }
  });

  it('performance DDL treats non-positive prices as unavailable for price-derived structures', () => {
    for (const ddl of [perfDdl, schemaDdl]) {
      expect(ddl).toMatch(/idx_products_discount[\s\S]*list_price > 0[\s\S]*price > 0[\s\S]*price < list_price/i);
      expect(ddl).toMatch(/MIN\(price\) FILTER \(WHERE price IS NOT NULL AND price > 0 AND stars IS NOT NULL\)/i);
      expect(ddl).toMatch(/AVG\(price\) FILTER \(WHERE price IS NOT NULL AND price > 0\)/i);
      expect(ddl).toMatch(/WHERE p\.price IS NOT NULL\s+AND p\.price > 0\s+AND p\.stars IS NOT NULL/i);
    }
  });
});
