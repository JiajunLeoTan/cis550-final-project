export default function HorizontalBars({
  data = [],
  color = 'var(--emerald-600)',
  valueFormat = (v) => v,
  height = 320
}) {
  if (!data.length) return null;
  const max = Math.max(...data.map((d) => Number(d.value) || 0), 1);
  const width = 640;
  const padL = 160;
  const padR = 70;
  const padT = 10;
  const padB = 10;
  const rowH = (height - padT - padB) / data.length;

  return (
    <svg
      className="chart-svg"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="xMidYMid meet"
      role="img"
    >
      {data.map((d, i) => {
        const v = Number(d.value) || 0;
        const w = ((v / max) * (width - padL - padR)) || 0;
        const y = padT + i * rowH;
        const barH = Math.max(rowH - 10, 6);
        return (
          <g key={i}>
            <text
              className="chart-axis"
              x={padL - 12}
              y={y + barH / 2 + 4}
              textAnchor="end"
              style={{ fontSize: 11 }}
            >
              {d.label}
            </text>
            <rect
              x={padL}
              y={y}
              width={w}
              height={barH}
              rx={5}
              fill={color}
              style={{ transition: 'width 520ms var(--ease-out)' }}
            />
            <text
              className="chart-axis"
              x={padL + w + 8}
              y={y + barH / 2 + 4}
              style={{ fontSize: 11 }}
            >
              {valueFormat(v)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
