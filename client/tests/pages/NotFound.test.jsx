import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import NotFound from '../../src/pages/NotFound.jsx';
import { renderWith } from '../test-utils.jsx';

describe('NotFound', () => {
  it('renders the 404 heading and a back-home link', () => {
    renderWith(<NotFound />);
    expect(screen.getByRole('heading', { name: /404/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Back home/ })).toHaveAttribute('href', '/');
  });
});
