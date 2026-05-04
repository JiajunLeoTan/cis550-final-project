import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Rating from '../../src/components/Rating.jsx';

describe('Rating', () => {
  it('renders stars and count for a real rating', () => {
    render(<Rating stars={4.236} count={1234} />);
    expect(screen.getByText('4.2')).toBeInTheDocument();
    expect(screen.getByText(/1,234/)).toBeInTheDocument();
  });

  it('shows the no-rating fallback when stars is null', () => {
    render(<Rating stars={null} count={5} />);
    expect(screen.getByText('No ratings yet')).toBeInTheDocument();
  });

  it('shows the fallback when count is null', () => {
    render(<Rating stars={4} count={null} />);
    expect(screen.getByText('No ratings yet')).toBeInTheDocument();
  });

  it('shows the fallback when count is zero or negative', () => {
    const { rerender } = render(<Rating stars={4} count={0} />);
    expect(screen.getByText('No ratings yet')).toBeInTheDocument();
    rerender(<Rating stars={4} count={-3} />);
    expect(screen.getByText('No ratings yet')).toBeInTheDocument();
  });

  it('shows the fallback when count is non-numeric', () => {
    render(<Rating stars={4} count={'abc'} />);
    expect(screen.getByText('No ratings yet')).toBeInTheDocument();
  });
});
