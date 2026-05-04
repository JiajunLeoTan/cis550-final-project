import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useApi } from '../../src/api/useApi.js';

describe('useApi', () => {
  it('starts loading and stores data on success', async () => {
    const fn = vi.fn().mockResolvedValue([1, 2, 3]);
    const { result } = renderHook(() => useApi(fn, []));

    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toEqual([1, 2, 3]);
    expect(result.current.error).toBeNull();
  });

  it('skips the call when skip is true', async () => {
    const fn = vi.fn();
    const { result } = renderHook(() => useApi(fn, [], { skip: true }));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(fn).not.toHaveBeenCalled();
    expect(result.current.data).toBeNull();
  });

  it('surfaces errors and stops loading', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('boom'));
    const { result } = renderHook(() => useApi(fn, []));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error.message).toBe('boom');
  });

  it('honors an initial value', async () => {
    const fn = vi.fn().mockResolvedValue('done');
    const { result } = renderHook(() =>
      useApi(fn, [], { initial: 'placeholder' })
    );

    expect(result.current.data).toBe('placeholder');
    await waitFor(() => expect(result.current.data).toBe('done'));
  });

  it('exposes a setData updater', async () => {
    const fn = vi.fn().mockResolvedValue('first');
    const { result } = renderHook(() => useApi(fn, []));
    await waitFor(() => expect(result.current.data).toBe('first'));

    act(() => result.current.setData('manual'));
    expect(result.current.data).toBe('manual');
  });

  it('ignores stale resolutions when deps change', async () => {
    let resolveFirst;
    let resolveSecond;
    const fn = vi
      .fn()
      .mockImplementationOnce(
        () => new Promise((res) => {
          resolveFirst = res;
        })
      )
      .mockImplementationOnce(
        () => new Promise((res) => {
          resolveSecond = res;
        })
      );

    let dep = 1;
    const { result, rerender } = renderHook(({ d }) => useApi(fn, [d]), {
      initialProps: { d: dep }
    });

    rerender({ d: 2 });
    expect(fn).toHaveBeenCalledTimes(2);

    await act(async () => {
      resolveFirst('stale');
      await Promise.resolve();
    });
    expect(result.current.data).toBeNull();

    await act(async () => {
      resolveSecond('fresh');
      await Promise.resolve();
    });
    await waitFor(() => expect(result.current.data).toBe('fresh'));
  });

  it('silently ignores AbortError', async () => {
    const fn = vi.fn().mockImplementation(() => {
      const err = new Error('aborted');
      err.name = 'AbortError';
      return Promise.reject(err);
    });
    const { result } = renderHook(() => useApi(fn, []));

    await waitFor(() => expect(result.current.loading).toBe(true));
    await new Promise((r) => setTimeout(r, 10));
    expect(result.current.error).toBeNull();
  });
});
