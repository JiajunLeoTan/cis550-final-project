export default function BarChart({
  data,
  height = 220,
  barColor = 'var(--accent)',
  valueFormat = (v) => v,
  showValues = true
}) {
  if (!data || data.length === 0) return null;
  const max = Math.max(...data.map((d) => Number(d.value) || 0), 1);
  const width = 520;
  const padL = 44;
  const padR = 14;
  const padT = 14;
  const padB = 28;
  const innerW = width - padL - padR;
  const innerH = height - padT - padB;
  const barW = innerW / data.length;

  return (
    <svg
      className="chart-svg"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="xMidYMid meet"
      role="img"
    >
      <g className="chart-axis">
        {[0, 0.5, 1].map((t) => {
          const y = padT + innerH * (1 - t);
          return (
            <g key={t}>
              <line
                x1={padL}
                x2={width - padR}
                y1={y}
                y2={y}
                stroke="var(--line)"
              />
              <text x={padL - 8} y={y + 3} textAnchor="end">
                {valueFormat(max * t)}
              </text>
            </g>
          );
        })}
      </g>

      {data.map((d, i) => {
        const v = Number(d.value) || 0;
        const h = (v / max) * innerH;
        const x = padL + i * barW + barW * 0.18;
        const w = barW * 0.64;
        const y = padT + innerH - h;
        return (
          <g key={i}>
            <rect
              x={x}
              y={y}
              width={w}
              height={h}
              rx={2}
              fill={barColor}
            />
            {showValues && (
              <text
                className="chart-axis"
                x={x + w / 2}
                y={Math.max(padT + 10, y - 6)}
                textAnchor="middle"
              >
                {valueFormat(v)}
              </text>
            )}
            <text
              className="chart-axis"
              x={x + w / 2}
              y={height - padB + 16}
              textAnchor="middle"
            >
              {d.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
