import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import QueryModeToggle from '../../src/components/QueryModeToggle.jsx';
import { api, BASE_URL } from '../../src/api/client.js';

const reloadSpy = vi.fn();
const fetchSpy = vi.fn(() => Promise.resolve({
  ok: true,
  json: () => Promise.resolve([])
}));

beforeEach(() => {
  reloadSpy.mockClear();
  fetchSpy.mockClear();
  vi.spyOn(globalThis, 'fetch').mockImplementation(fetchSpy);
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { ...window.location, reload: reloadSpy }
  });
});

describe('QueryModeToggle', () => {
  it('starts on optimized when no mode is stored', () => {
    render(<QueryModeToggle />);
    expect(screen.getByRole('button', { name: 'standard' })).toHaveAttribute(
      'aria-pressed',
      'false'
    );
    expect(screen.getByRole('button', { name: 'optimized' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
  });

  it('switches to standard, persists, and reloads', async () => {
    render(<QueryModeToggle />);
    await userEvent.click(screen.getByRole('button', { name: 'standard' }));
    expect(localStorage.getItem('queryMode')).toBe('standard');
    expect(reloadSpy).toHaveBeenCalledTimes(1);
  });

  it('does nothing when clicking the already-active mode', async () => {
    render(<QueryModeToggle />);
    await userEvent.click(screen.getByRole('button', { name: 'optimized' }));
    expect(reloadSpy).not.toHaveBeenCalled();
  });

  it('switching back to optimized removes the persisted standard override', async () => {
    localStorage.setItem('queryMode', 'standard');
    render(<QueryModeToggle />);
    await userEvent.click(screen.getByRole('button', { name: 'optimized' }));
    expect(localStorage.getItem('queryMode')).toBeNull();
    expect(reloadSpy).toHaveBeenCalledTimes(1);
  });

  it('standard button selects standard queries and optimized button selects optimized queries', async () => {
    render(<QueryModeToggle />);

    await userEvent.click(screen.getByRole('button', { name: 'standard' }));
    await api.categories();
    expect(fetchSpy.mock.calls[0][0]).toBe(`${BASE_URL}/categories`);

    await userEvent.click(screen.getByRole('button', { name: 'optimized' }));
    await api.categories();
    expect(fetchSpy.mock.calls[1][0]).toBe(`${BASE_URL}/categories?optimized=1`);
  });
});
