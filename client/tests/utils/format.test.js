import { describe, it, expect } from 'vitest';
import {
  formatCurrency,
  formatProductPrice,
  formatStars,
  formatCount,
  formatPercent,
  formatMonth,
  formatDate,
  isValidPrice,
  truncate
} from '../../src/utils/format.js';

describe('formatCurrency', () => {
  it('renders standard USD for non-compact values', () => {
    expect(formatCurrency(12.5)).toBe('$12.50');
  });

  it('renders compact for large values when requested', () => {
    expect(formatCurrency(1500, { compact: true })).toMatch(/\$1\.5K/i);
  });

  it('uses standard for small values even when compact requested', () => {
    expect(formatCurrency(50, { compact: true })).toBe('$50.00');
  });

  it('returns - for null, undefined, and NaN', () => {
    expect(formatCurrency(null)).toBe('-');
    expect(formatCurrency(undefined)).toBe('-');
    expect(formatCurrency('not-a-number')).toBe('-');
  });

  it('coerces numeric strings', () => {
    expect(formatCurrency('19.99')).toBe('$19.99');
  });
});

describe('product price formatting', () => {
  it('treats only positive finite values as product prices', () => {
    expect(isValidPrice(12.5)).toBe(true);
    expect(isValidPrice('19.99')).toBe(true);
    expect(isValidPrice(0)).toBe(false);
    expect(isValidPrice(-1)).toBe(false);
    expect(isValidPrice(null)).toBe(false);
    expect(isValidPrice('not-a-number')).toBe(false);
  });

  it('renders unavailable product prices explicitly', () => {
    expect(formatProductPrice(12.5)).toBe('$12.50');
    expect(formatProductPrice(0)).toBe('Price unavailable');
    expect(formatProductPrice(null)).toBe('Price unavailable');
  });
});

describe('formatStars', () => {
  it('returns one decimal place', () => {
    expect(formatStars(4.236)).toBe('4.2');
  });

  it('returns - for missing or non-numeric input', () => {
    expect(formatStars(null)).toBe('-');
    expect(formatStars(undefined)).toBe('-');
    expect(formatStars('abc')).toBe('-');
  });
});

describe('formatCount', () => {
  it('formats small counts with thousands separators', () => {
    expect(formatCount(1234)).toBe('1,234');
  });

  it('switches to compact for >= 10k', () => {
    expect(formatCount(15000)).toMatch(/15K/i);
  });

  it('falls back to "0" for null and NaN', () => {
    expect(formatCount(null)).toBe('0');
    expect(formatCount('abc')).toBe('0');
  });

  it('coerces numeric strings', () => {
    expect(formatCount('500')).toBe('500');
  });
});

describe('formatPercent', () => {
  it('renders with one decimal by default', () => {
    expect(formatPercent(12.345)).toBe('12.3%');
  });

  it('honors custom digit count', () => {
    expect(formatPercent(12.345, 2)).toBe('12.35%');
  });

  it('returns - for missing input', () => {
    expect(formatPercent(null)).toBe('-');
    expect(formatPercent('xx')).toBe('-');
  });
});

describe('formatMonth', () => {
  it('renders "MMM YY" for valid dates', () => {
    expect(formatMonth('2024-03-15')).toMatch(/Mar 24/);
  });

  it('returns empty string for falsy or invalid input', () => {
    expect(formatMonth('')).toBe('');
    expect(formatMonth(null)).toBe('');
    expect(formatMonth('not-a-date')).toBe('');
  });
});

describe('formatDate', () => {
  it('renders "MMM D, YYYY" for valid dates', () => {
    expect(formatDate('2024-03-15')).toMatch(/Mar 1[45], 2024/);
  });

  it('returns empty string for falsy or invalid input', () => {
    expect(formatDate('')).toBe('');
    expect(formatDate(null)).toBe('');
    expect(formatDate('garbage')).toBe('');
  });
});

describe('truncate', () => {
  it('returns original text below the limit', () => {
    expect(truncate('hello', 10)).toBe('hello');
  });

  it('truncates with ellipsis above the limit', () => {
    expect(truncate('hello world', 7)).toBe('hello ...');
  });

  it('uses default length when none provided', () => {
    const long = 'a'.repeat(150);
    const result = truncate(long);
    expect(result.endsWith('...')).toBe(true);
    expect(result.length).toBeLessThan(long.length);
  });

  it('returns empty string for falsy input', () => {
    expect(truncate('')).toBe('');
    expect(truncate(null)).toBe('');
  });
});
