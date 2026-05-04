import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  SkeletonCard,
  SkeletonGrid,
  Empty,
  ErrorBanner
} from '../../src/components/States.jsx';

describe('SkeletonCard / SkeletonGrid', () => {
  it('renders a skeleton card with placeholder lines', () => {
    const { container } = render(<SkeletonCard />);
    expect(container.querySelectorAll('.skeleton').length).toBeGreaterThan(0);
  });

  it('SkeletonGrid uses default count when not provided', () => {
    const { container } = render(<SkeletonGrid />);
    expect(container.querySelectorAll('.card').length).toBe(8);
  });

  it('SkeletonGrid honors a custom count', () => {
    const { container } = render(<SkeletonGrid count={3} />);
    expect(container.querySelectorAll('.card').length).toBe(3);
  });
});

describe('Empty', () => {
  it('renders the default title when none supplied', () => {
    render(<Empty />);
    expect(screen.getByText('Nothing here yet')).toBeInTheDocument();
  });

  it('renders title, description, and an action when provided', () => {
    render(<Empty title="Nothing" description="Try again" action={<button>retry</button>} />);
    expect(screen.getByText('Nothing')).toBeInTheDocument();
    expect(screen.getByText('Try again')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'retry' })).toBeInTheDocument();
  });
});

describe('ErrorBanner', () => {
  it('renders nothing when there is no error', () => {
    const { container } = render(<ErrorBanner error={null} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders the error message', () => {
    render(<ErrorBanner error={{ message: 'oh no' }} />);
    expect(screen.getByText('oh no')).toBeInTheDocument();
  });

  it('falls back to a generic message when error has no message', () => {
    render(<ErrorBanner error={{}} />);
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });

  it('renders a Retry button only when onRetry is provided', () => {
    const { rerender } = render(<ErrorBanner error={{ message: 'x' }} />);
    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull();

    const onRetry = vi.fn();
    rerender(<ErrorBanner error={{ message: 'x' }} onRetry={onRetry} />);
    const btn = screen.getByRole('button', { name: 'Retry' });
    expect(btn).toBeInTheDocument();
  });

  it('invokes onRetry when the button is clicked', async () => {
    const onRetry = vi.fn();
    render(<ErrorBanner error={{ message: 'x' }} onRetry={onRetry} />);
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
