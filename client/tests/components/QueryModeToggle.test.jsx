import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import QueryModeToggle from '../../src/components/QueryModeToggle.jsx';

const reloadSpy = vi.fn();

beforeEach(() => {
  reloadSpy.mockClear();
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { ...window.location, reload: reloadSpy }
  });
});

describe('QueryModeToggle', () => {
  it('starts on standard when no mode is stored', () => {
    render(<QueryModeToggle />);
    expect(screen.getByRole('button', { name: 'standard' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    expect(screen.getByRole('button', { name: 'optimized' })).toHaveAttribute(
      'aria-pressed',
      'false'
    );
  });

  it('switches to optimized, persists, and reloads', async () => {
    render(<QueryModeToggle />);
    await userEvent.click(screen.getByRole('button', { name: 'optimized' }));
    expect(localStorage.getItem('queryMode')).toBe('new');
    expect(reloadSpy).toHaveBeenCalledTimes(1);
  });

  it('does nothing when clicking the already-active mode', async () => {
    render(<QueryModeToggle />);
    await userEvent.click(screen.getByRole('button', { name: 'standard' }));
    expect(reloadSpy).not.toHaveBeenCalled();
  });

  it('switching back to standard removes the persisted key', async () => {
    localStorage.setItem('queryMode', 'new');
    render(<QueryModeToggle />);
    await userEvent.click(screen.getByRole('button', { name: 'standard' }));
    expect(localStorage.getItem('queryMode')).toBeNull();
    expect(reloadSpy).toHaveBeenCalledTimes(1);
  });
});
