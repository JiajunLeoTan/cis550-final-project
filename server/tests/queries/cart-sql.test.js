import { describe, it, expect } from 'vitest';
import {
  cartSavingsQuery,
  cartSavingsQueryOptimized
} from '../../queries/cart.sql.js';

describe('cart SQL regressions', () => {
  it('cart totals treat non-positive prices as unavailable', () => {
    for (const sql of [cartSavingsQuery, cartSavingsQueryOptimized]) {
      expect(sql).toMatch(/CASE\s+WHEN list_price > 0 THEN list_price ELSE 0 END/i);
      expect(sql).toMatch(/CASE\s+WHEN price > 0 THEN price ELSE 0 END/i);
      expect(sql).toMatch(/WHEN list_price > 0 AND price > 0 AND list_price > price/i);
      expect(sql).not.toMatch(/SUM\(price\)/i);
      expect(sql).not.toMatch(/COALESCE\(list_price,\s*0\)\s*-\s*COALESCE\(price,\s*0\)/i);
    }
  });
});
