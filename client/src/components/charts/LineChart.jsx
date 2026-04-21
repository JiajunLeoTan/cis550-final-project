export default function LineChart({
  series = [],
  xLabels = [],
  height = 260,
  yDomain,
  valueFormat = (v) => Number(v).toFixed(1)
}) {
  if (!series.length || !xLabels.length) return null;

  const width = 640;
  const padL = 46;
  const padR = 16;
  const padT = 16;
  const padB = 30;
  const innerW = width - padL - padR;
  const innerH = height - padT - padB;

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
    values.forEach((v, i) => {
      if (v == null || !Number.isFinite(v)) return;
      const cmd = d ? 'L' : 'M';
      d += `${cmd}${xAt(i).toFixed(2)} ${yAt(v).toFixed(2)} `;
    });
    return d.trim();
  };

  const gridLines = 4;

  return (
    <svg
      className="chart-svg"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="xMidYMid meet"
      role="img"
    >
      <g className="chart-axis">
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
                strokeDasharray={i === 0 ? '0' : '3 4'}
              />
              <text x={padL - 8} y={y + 3} textAnchor="end">
                {valueFormat(v)}
              </text>
            </g>
          );
        })}

        {xLabels.map((lbl, i) => {
          if (xLabels.length > 8 && i % Math.ceil(xLabels.length / 6) !== 0) return null;
          return (
            <text
              key={i}
              x={xAt(i)}
              y={height - padB + 16}
              textAnchor="middle"
            >
              {lbl}
            </text>
          );
        })}
      </g>

      {series.map((s, idx) => {
        const path = buildPath(s.values);
        if (!path) return null;
        return (
          <g key={idx}>
            <path
              d={path}
              fill="none"
              stroke={s.color || 'var(--emerald-600)'}
              strokeWidth={s.strokeWidth || 2}
              strokeDasharray={s.dashed ? '5 4' : undefined}
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{
                strokeDashoffset: 0,
                transition: 'd 520ms var(--ease-out)'
              }}
            />
            {s.values.map((v, i) =>
              v == null ? null : (
                <circle
                  key={i}
                  cx={xAt(i)}
                  cy={yAt(v)}
                  r={2.5}
                  fill={s.color || 'var(--emerald-600)'}
                />
              )
            )}
          </g>
        );
      })}

      {series.length > 1 && (
        <g transform={`translate(${padL}, ${padT - 4})`}>
          {series.map((s, i) => (
            <g key={i} transform={`translate(${i * 150}, 0)`}>
              <line
                x1={0}
                x2={16}
                y1={-2}
                y2={-2}
                stroke={s.color || 'var(--emerald-600)'}
                strokeWidth={2}
                strokeDasharray={s.dashed ? '4 3' : undefined}
              />
              <text className="chart-axis" x={22} y={1}>
                {s.label}
              </text>
            </g>
          ))}
        </g>
      )}
    </svg>
  );
}
