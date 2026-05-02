export default function HorizontalBars({
  data = [],
  color = 'var(--accent)',
  valueFormat = (v) => v,
  height = 320,
  maxLabelChars = 24,
  getHref,
  onSelect
}) {
  if (!data.length) return null;
  const max = Math.max(...data.map((d) => Number(d.value) || 0), 1);
  const width = 640;
  const padL = 160;
  const padR = 70;
  const padT = 10;
  const padB = 10;
  const rowH = (height - padT - padB) / data.length;
  const truncate = (label) => {
    const text = String(label || '-');
    return text.length > maxLabelChars ? `${text.slice(0, maxLabelChars - 3)}...` : text;
  };

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
        const valueText = valueFormat(v);
        const valueX = Math.min(padL + w + 8, width - 8);
        const valueAnchor = valueX >= width - 8 ? 'end' : 'start';
        const href = getHref ? getHref(d) : null;
        const handleClick = (event) => {
          if (!onSelect || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
            return;
          }
          event.preventDefault();
          onSelect(d);
        };
        const row = (
          <g key={i}>
            <title>{`${d.label}: ${valueText}`}</title>
            <text
              className="chart-axis"
              x={padL - 12}
              y={y + barH / 2 + 4}
              textAnchor="end"
              style={{ fontSize: 11 }}
            >
              {truncate(d.label)}
            </text>
            <rect
              x={padL}
              y={y}
              width={w}
              height={barH}
              rx={2}
              fill={color}
            />
            <text
              className="chart-axis"
              x={valueX}
              y={y + barH / 2 + 4}
              textAnchor={valueAnchor}
              style={{ fontSize: 11 }}
            >
              {valueText}
            </text>
          </g>
        );

        if (!href) return row;

        return (
          <a
            key={i}
            className="chart-link"
            href={href}
            onClick={handleClick}
            aria-label={`Open ${d.label}`}
          >
            {row}
          </a>
        );
      })}
    </svg>
  );
}
