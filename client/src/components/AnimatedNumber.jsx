import { useEffect, useRef, useState } from 'react';

export default function AnimatedNumber({
  value,
  duration = 700,
  format = (n) => n.toFixed(0),
  className = ''
}) {
  const [display, setDisplay] = useState(value ?? 0);
  const prev = useRef(value ?? 0);
  const frame = useRef(0);

  useEffect(() => {
    const from = prev.current;
    const to = Number.isFinite(value) ? value : 0;
    if (from === to) return undefined;
    const start = performance.now();
    cancelAnimationFrame(frame.current);

    const reduce =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    if (reduce) {
      setDisplay(to);
      prev.current = to;
      return undefined;
    }

    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const current = from + (to - from) * eased;
      setDisplay(current);
      if (t < 1) {
        frame.current = requestAnimationFrame(tick);
      } else {
        prev.current = to;
      }
    };
    frame.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame.current);
  }, [value, duration]);

  return <span className={`text-num ${className}`}>{format(display)}</span>;
}
