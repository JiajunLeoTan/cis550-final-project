import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import HorizontalBars from '../../../src/components/charts/HorizontalBars.jsx';

describe('HorizontalBars', () => {
  it('returns null when there is no data', () => {
    const { container } = render(<HorizontalBars data={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders one row group per data item', () => {
    const { container } = render(
      <HorizontalBars
        data={[
          { label: 'A', value: 5 },
          { label: 'B', value: 10 }
        ]}
      />
    );
    expect(container.querySelectorAll('rect').length).toBe(2);
  });

  it('truncates long labels and uses the value formatter', () => {
    const { container } = render(
      <HorizontalBars
        data={[{ label: 'A very very very very long label here', value: 1234 }]}
        maxLabelChars={10}
        valueFormat={(v) => `${v}!`}
      />
    );
    const text = Array.from(container.querySelectorAll('text')).map((t) => t.textContent);
    expect(text.some((t) => t.includes('...'))).toBe(true);
    expect(text.some((t) => t === '1234!')).toBe(true);
  });

  it('wraps rows in anchors when getHref is provided and triggers onSelect', () => {
    const onSelect = vi.fn();
    const data = [{ label: 'Beauty', value: 50 }];
    const { container } = render(
      <MemoryRouter>
        <HorizontalBars
          data={data}
          getHref={(d) => `/category/${d.label}`}
          onSelect={onSelect}
        />
      </MemoryRouter>
    );
    const anchor = container.querySelector('a.chart-link');
    expect(anchor).not.toBeNull();
    expect(anchor.getAttribute('href')).toBe('/category/Beauty');

    fireEvent.click(anchor);
    expect(onSelect).toHaveBeenCalledWith(data[0]);
  });

  it('does not call onSelect when modifier keys are held', () => {
    const onSelect = vi.fn();
    const { container } = render(
      <MemoryRouter>
        <HorizontalBars
          data={[{ label: 'A', value: 1 }]}
          getHref={() => '/x'}
          onSelect={onSelect}
        />
      </MemoryRouter>
    );
    fireEvent.click(container.querySelector('a.chart-link'), { metaKey: true });
    expect(onSelect).not.toHaveBeenCalled();
  });
});
