import { useMemo, useState } from 'react';

export default function LineChart({
  series = [],
  xLabels = [],
  xValues = [],
  volumes,
  yLabel,
  volumeLabel,
  height = 260,
  yDomain,
  valueFormat = (v) => Number(v).toFixed(1)
}) {
  const [hoverIdx, setHoverIdx] = useState(null);

  const yearTicks = useMemo(() => {
    if (!xValues || xValues.length !== xLabels.length) return null;
    const ticks = [];
    let prevYear = null;
    xValues.forEach((iso, i) => {
      if (!iso) return;
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return;
      const year = d.getFullYear();
      if (year !== prevYear) {
        ticks.push({ idx: i, label: String(year) });
        prevYear = year;
      }
    });
    return ticks.length >= 2 ? ticks : null;
  }, [xValues, xLabels]);

  const fitTicks = (ticks, xAtFn, minPx) => {
    if (!ticks || !ticks.length) return ticks;
    const kept = [ticks[0]];
    for (let i = 1; i < ticks.length; i += 1) {
      const t = ticks[i];
      const last = kept[kept.length - 1];
      const isLast = i === ticks.length - 1;
      if (xAtFn(t.idx) - xAtFn(last.idx) >= minPx) {
        kept.push(t);
      } else if (isLast && kept.length > 1) {
        kept[kept.length - 1] = t;
      }
    }
    return kept;
  };

  const fallbackTicks = useMemo(() => {
    if (yearTicks) return null;
    const stride = xLabels.length > 8 ? Math.ceil(xLabels.length / 6) : 1;
    return xLabels
      .map((label, idx) => ({ idx, label }))
      .filter(({ idx }) => idx % stride === 0);
  }, [xLabels, yearTicks]);

  if (!series.length || !xLabels.length) return null;

  const hasVolumes = Array.isArray(volumes) && volumes.length === xLabels.length;
  const volH = hasVolumes ? 22 : 0;
  const volGap = hasVolumes ? 18 : 0;
  const xLabelGap = 6;
  const xLabelH = 18;
  const hasYLabel = Boolean(yLabel);
  const hasVolLabel = hasVolumes && Boolean(volumeLabel);

  const width = 640;
  const padL = hasYLabel ? 64 : 46;
  const padR = 16;
  const padT = 8;
  const padB = volGap + volH + xLabelGap + xLabelH;
  const innerW = width - padL - padR;
  const innerH = height - padT - padB;
  const volTop = padT + innerH + volGap;
  const xLabelY = volTop + volH + xLabelGap + 12;

  const allValues = series
    .flatMap((s) => s.values)
    .filter((v) => v != null && Number.isFinite(v));

  if (allValues.length === 0) return null;
  const minV = yDomain?.[0] ?? Math.min(...allValues);
  const maxV = yDomain?.[1] ?? Math.max(...allValues);
  const rangeV = maxV - minV || 1;

  const xAt = (i) =>
    xLabels.length === 1
      ? padL + innerW / 2
      : padL + (i / (xLabels.length - 1)) * innerW;
  const yAt = (v) => padT + innerH * (1 - (v - minV) / rangeV);

  const buildPath = (values) => {
    let d = '';
    let prevValid = false;
    values.forEach((v, i) => {
      if (v == null || !Number.isFinite(v)) {
        prevValid = false;
        return;
      }
      const cmd = prevValid ? 'L' : 'M';
      d += `${cmd}${xAt(i).toFixed(2)} ${yAt(v).toFixed(2)} `;
      prevValid = true;
    });
    return d.trim();
  };

  const maxVolume = hasVolumes ? Math.max(1, ...volumes.map((v) => v || 0)) : 1;

  const gridLines = 4;

  const tooltip = (() => {
    if (hoverIdx == null) return null;
    const month = xLabels[hoverIdx];
    const lines = series
      .map((s) => {
        const v = s.values[hoverIdx];
        if (v == null || !Number.isFinite(v)) return null;
        return { label: s.label, color: s.color, value: valueFormat(v) };
      })
      .filter(Boolean);
    const vol = hasVolumes ? volumes[hoverIdx] : null;
    if (!lines.length && vol == null) return null;
    return { month, lines, vol };
  })();

  const tooltipWidth = 168;
  const tooltipLineH = 16;
  const tooltipPadding = 8;
  const tooltipHeight = tooltip
    ? tooltipPadding * 2
        + tooltipLineH
        + (tooltip.lines.length * tooltipLineH)
        + (tooltip.vol != null ? tooltipLineH : 0)
    : 0;
  const tooltipX = tooltip
    ? Math.max(
        padL,
        Math.min(width - padR - tooltipWidth, xAt(hoverIdx) - tooltipWidth / 2)
      )
    : 0;
  const tooltipY = padT + 4;

  return (
    <>
      {series.length > 1 && (
        <ul className="chart-legend" aria-hidden="true">
          {series.map((s) => (
            <li key={s.label}>
              <span
                className={`chart-legend-swatch${s.dashed ? ' dashed' : ''}`}
                style={
                  s.dashed
                    ? { borderTopColor: s.color || 'var(--accent)' }
                    : { background: s.color || 'var(--accent)' }
                }
              />
              {s.label}
            </li>
          ))}
        </ul>
      )}
      <svg
        className="chart-svg"
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="xMidYMid meet"
        role="img"
      >
        <g className="chart-axis">
          {hasYLabel && (
            <text
              className="chart-axis-title"
              x={16}
              y={padT + innerH / 2}
              textAnchor="middle"
              transform={`rotate(-90, 16, ${padT + innerH / 2})`}
            >
              {yLabel}
            </text>
          )}
          {Array.from({ length: gridLines + 1 }).map((_, i) => {
            const t = i / gridLines;
            const y = padT + innerH * (1 - t);
            const v = minV + rangeV * t;
            return (
              <g key={i}>
                <line
                  x1={padL}
                  x2={width - padR}
                  y1={y}
                  y2={y}
                  stroke="var(--line)"
                />
                <text x={padL - 8} y={y + 3} textAnchor="end">
                  {valueFormat(v)}
                </text>
              </g>
            );
          })}

          {fitTicks(yearTicks || fallbackTicks, xAt, 38).map(({ idx, label }) => (
            <g key={idx}>
              <line
                x1={xAt(idx)}
                x2={xAt(idx)}
                y1={padT + innerH}
                y2={padT + innerH + 4}
                stroke="var(--line)"
              />
              <text
                x={xAt(idx)}
                y={xLabelY}
                textAnchor="middle"
              >
                {label}
              </text>
            </g>
          ))}
        </g>

        {hasVolumes && (
          <g>
            {hasVolLabel && (
              <text
                className="chart-axis"
                x={padL}
                y={volTop - 4}
                textAnchor="start"
              >
                {volumeLabel}
              </text>
            )}
            {volumes.map((v, i) => {
              const value = Number(v) || 0;
              if (value <= 0) return null;
              const h = (value / maxVolume) * volH;
              const barW = Math.max(
                1.5,
                xLabels.length > 1 ? innerW / xLabels.length - 1 : 6
              );
              return (
                <rect
                  key={i}
                  x={xAt(i) - barW / 2}
                  y={volTop + (volH - h)}
                  width={barW}
                  height={h}
                  fill="var(--ink-3)"
                  opacity={hoverIdx === i ? 0.5 : 0.22}
                />
              );
            })}
          </g>
        )}

        {hoverIdx != null && (
          <line
            x1={xAt(hoverIdx)}
            x2={xAt(hoverIdx)}
            y1={padT}
            y2={padT + innerH + (hasVolumes ? volGap + volH : 0)}
            stroke="var(--ink-3)"
            strokeOpacity={0.35}
            strokeDasharray="3 3"
          />
        )}

        {series.map((s, idx) => {
          const path = buildPath(s.values);
          if (!path) return null;
          return (
            <g key={idx}>
              <path
                d={path}
                fill="none"
                stroke={s.color || 'var(--accent)'}
                strokeWidth={s.strokeWidth || 2}
                strokeDasharray={s.dashed ? '5 4' : undefined}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {s.values.map((v, i) =>
                v == null ? null : (
                  <circle
                    key={i}
                    cx={xAt(i)}
                    cy={yAt(v)}
                    r={hoverIdx === i ? 4 : 2.5}
                    fill={s.color || 'var(--accent)'}
                  />
                )
              )}
            </g>
          );
        })}

        {xLabels.map((_, i) => {
          const left = i === 0 ? padL : (xAt(i - 1) + xAt(i)) / 2;
          const right = i === xLabels.length - 1
            ? width - padR
            : (xAt(i) + xAt(i + 1)) / 2;
          return (
            <rect
              key={i}
              x={left}
              y={padT}
              width={Math.max(1, right - left)}
              height={innerH + volGap + volH}
              fill="transparent"
              onMouseEnter={() => setHoverIdx(i)}
              onMouseLeave={() => setHoverIdx((cur) => (cur === i ? null : cur))}
            />
          );
        })}

        {tooltip && (
          <g pointerEvents="none">
            <rect
              x={tooltipX}
              y={tooltipY}
              width={tooltipWidth}
              height={tooltipHeight}
              rx={6}
              ry={6}
              fill="var(--bg)"
              stroke="var(--line)"
            />
            <text
              x={tooltipX + tooltipPadding}
              y={tooltipY + tooltipPadding + 11}
              className="chart-tooltip-title"
            >
              {tooltip.month}
            </text>
            {tooltip.lines.map((ln, i) => {
              const ty = tooltipY + tooltipPadding + tooltipLineH + (i * tooltipLineH) + 11;
              return (
                <g key={ln.label}>
                  <rect
                    x={tooltipX + tooltipPadding}
                    y={ty - 8}
                    width={8}
                    height={8}
                    fill={ln.color || 'var(--accent)'}
                  />
                  <text
                    x={tooltipX + tooltipPadding + 14}
                    y={ty}
                    className="chart-tooltip-label"
                  >
                    {ln.label}
                  </text>
                  <text
                    x={tooltipX + tooltipWidth - tooltipPadding}
                    y={ty}
                    textAnchor="end"
                    className="chart-tooltip-value"
                  >
                    {ln.value}
                  </text>
                </g>
              );
            })}
            {tooltip.vol != null && (
              <g>
                <text
                  x={tooltipX + tooltipPadding}
                  y={tooltipY + tooltipHeight - tooltipPadding - 2}
                  className="chart-tooltip-label"
                >
                  reviews
                </text>
                <text
                  x={tooltipX + tooltipWidth - tooltipPadding}
                  y={tooltipY + tooltipHeight - tooltipPadding - 2}
                  textAnchor="end"
                  className="chart-tooltip-value"
                >
                  {tooltip.vol}
                </text>
              </g>
            )}
          </g>
        )}
      </svg>
    </>
  );
}
