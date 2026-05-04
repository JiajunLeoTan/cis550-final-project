import { describe, it, expect, beforeEach, vi } from 'vitest';
import { cached, clearCache } from '../cache.js';

describe('cache', () => {
  beforeEach(() => {
    clearCache();
  });

  it('runs the loader on a miss and stores the value', async () => {
    const loader = vi.fn().mockResolvedValue('first');

    const a = await cached('k', 1000, loader);
    const b = await cached('k', 1000, loader);

    expect(a).toBe('first');
    expect(b).toBe('first');
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('runs the loader again after the TTL elapses', async () => {
    const loader = vi.fn();
    loader.mockResolvedValueOnce('one').mockResolvedValueOnce('two');

    const start = 1_000_000;
    const dateSpy = vi.spyOn(Date, 'now');
    dateSpy.mockReturnValue(start);
    await cached('k', 100, loader);

    dateSpy.mockReturnValue(start + 50);
    const stillCached = await cached('k', 100, loader);
    expect(stillCached).toBe('one');

    dateSpy.mockReturnValue(start + 200);
    const refreshed = await cached('k', 100, loader);
    expect(refreshed).toBe('two');
    expect(loader).toHaveBeenCalledTimes(2);

    dateSpy.mockRestore();
  });

  it('keeps separate values per key', async () => {
    const loader = vi.fn();
    loader.mockResolvedValueOnce(1).mockResolvedValueOnce(2);

    const a = await cached('a', 1000, loader);
    const b = await cached('b', 1000, loader);

    expect(a).toBe(1);
    expect(b).toBe(2);
  });

  it('clearCache removes all entries', async () => {
    const loader = vi.fn().mockResolvedValue('x');
    await cached('k', 1000, loader);
    clearCache();
    await cached('k', 1000, loader);

    expect(loader).toHaveBeenCalledTimes(2);
  });
});
