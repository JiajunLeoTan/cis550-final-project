import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import StarIcon from '../../src/components/StarIcon.jsx';

describe('StarIcon', () => {
  it('renders a filled star at the default size', () => {
    const { container } = render(<StarIcon />);
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
    expect(svg.getAttribute('width')).toBe('14');
    expect(svg.getAttribute('fill')).toBe('currentColor');
  });

  it('renders an outline star when filled is false', () => {
    const { container } = render(<StarIcon filled={false} size={20} />);
    const svg = container.querySelector('svg');
    expect(svg.getAttribute('fill')).toBe('none');
    expect(svg.getAttribute('width')).toBe('20');
    expect(svg.getAttribute('stroke-width')).toBe('1.5');
  });

  it('appends the provided className', () => {
    const { container } = render(<StarIcon className="custom" />);
    expect(container.querySelector('svg').className.baseVal).toContain('custom');
  });
});
