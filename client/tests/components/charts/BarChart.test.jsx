import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import BarChart from '../../../src/components/charts/BarChart.jsx';

describe('BarChart', () => {
  it('returns null with no data', () => {
    const { container } = render(<BarChart data={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('returns null when data is undefined', () => {
    const { container } = render(<BarChart />);
    expect(container.firstChild).toBeNull();
  });

  it('renders a bar per row plus axis text', () => {
    const { container } = render(
      <BarChart
        data={[
          { label: '1', value: 5 },
          { label: '2', value: 10 },
          { label: '3', value: 0 }
        ]}
      />
    );
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
    const rects = container.querySelectorAll('rect');
    expect(rects.length).toBe(3);
  });

  it('hides per-bar values when showValues is false', () => {
    const data = [
      { label: 'A', value: 5 },
      { label: 'B', value: 10 }
    ];
    const { container: withValues } = render(<BarChart data={data} showValues />);
    const { container: noValues } = render(<BarChart data={data} showValues={false} />);
    expect(withValues.querySelectorAll('text').length).toBeGreaterThan(
      noValues.querySelectorAll('text').length
    );
  });

  it('formats values via the provided formatter', () => {
    const { container } = render(
      <BarChart
        data={[{ label: 'A', value: 1234 }]}
        valueFormat={(v) => `#${v}`}
      />
    );
    const allText = Array.from(container.querySelectorAll('text')).map((t) => t.textContent);
    expect(allText).toContain('#1234');
  });
});
