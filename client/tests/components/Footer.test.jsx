import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import Footer from '../../src/components/Footer.jsx';
import { renderWith } from '../test-utils.jsx';

describe('Footer', () => {
  it('renders brand wordmark, tagline, and credits', () => {
    renderWith(<Footer />);
    expect(screen.getByText('Axiom')).toBeInTheDocument();
    expect(screen.getByText('Colophon')).toBeInTheDocument();
    expect(screen.getByText(/A catalog of beauty/)).toBeInTheDocument();
    expect(screen.getByText(/CIS 550/)).toBeInTheDocument();
  });

  it('renders the SQL mode toggle group', () => {
    renderWith(<Footer />);
    expect(screen.getByRole('group', { name: /Query mode/i })).toBeInTheDocument();
  });
});
