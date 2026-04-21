import { useEffect, useRef, useState } from 'react';

export function useApi(fn, deps = [], { skip = false, initial = null } = {}) {
  const [data, setData] = useState(initial);
  const [loading, setLoading] = useState(!skip);
  const [error, setError] = useState(null);
  const counter = useRef(0);

  useEffect(() => {
    if (skip) {
      setLoading(false);
      return undefined;
    }
    const id = ++counter.current;
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    Promise.resolve(fn({ signal: controller.signal }))
      .then((res) => {
        if (id === counter.current) {
          setData(res);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (err.name === 'AbortError') return;
        if (id === counter.current) {
          setError(err);
          setLoading(false);
        }
      });

    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, loading, error, setData };
}
