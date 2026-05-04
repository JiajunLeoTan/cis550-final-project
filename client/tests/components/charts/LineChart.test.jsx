import { describe, it, expect } from 'vitest';
import { render, fireEvent, within } from '@testing-library/react';
import LineChart from '../../../src/components/charts/LineChart.jsx';

describe('LineChart', () => {
  it('returns null with no series', () => {
    const { container } = render(<LineChart series={[]} xLabels={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('returns null when all values are null', () => {
    const { container } = render(
      <LineChart
        series={[{ label: 'A', values: [null, null] }]}
        xLabels={['Jan', 'Feb']}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders a path per series with valid data', () => {
    const { container } = render(
      <LineChart
        series={[
          { label: 'A', values: [1, 2, 3] },
          { label: 'B', values: [3, 2, 1], color: '#f00', dashed: true }
        ]}
        xLabels={['Jan', 'Feb', 'Mar']}
        yLabel="Avg"
      />
    );
    expect(container.querySelectorAll('path').length).toBe(2);
    expect(container.querySelector('.chart-legend')).toBeInTheDocument();
  });

  it('renders volume bars when volumes prop is supplied', () => {
    const { container } = render(
      <LineChart
        series={[{ label: 'A', values: [1, 2, 3] }]}
        xLabels={['Jan', 'Feb', 'Mar']}
        volumes={[10, 20, 30]}
        volumeLabel="Reviews"
      />
    );
    const volumeRects = container.querySelectorAll('rect');
    expect(volumeRects.length).toBeGreaterThan(0);
  });

  it('shows the tooltip when a column area is hovered', () => {
    const { container, queryByText } = render(
      <LineChart
        series={[{ label: 'Overall', values: [4.0, 4.2, 4.4] }]}
        xLabels={['Jan', 'Feb', 'Mar']}
        xValues={['2024-01-01', '2024-02-01', '2024-03-01']}
        volumes={[10, 20, 30]}
      />
    );
    const overlay = container.querySelectorAll('rect[fill="transparent"]')[1];
    fireEvent.mouseEnter(overlay);
    expect(queryByText('Overall')).toBeInTheDocument();
    expect(queryByText('Feb')).toBeInTheDocument();
  });

  it('uses a custom yDomain when provided', () => {
    const { container } = render(
      <LineChart
        series={[{ label: 'A', values: [3, 4, 5] }]}
        xLabels={['x', 'y', 'z']}
        yDomain={[0, 10]}
      />
    );
    expect(container.querySelector('svg')).toBeInTheDocument();
  });
});
