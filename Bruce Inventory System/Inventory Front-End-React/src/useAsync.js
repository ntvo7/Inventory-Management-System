import { useCallback, useEffect, useRef, useState } from 'react';

// Loads data from an async function, with loading / error state and reload().
// Re-runs when any value in `deps` changes.
export function useAsync(fn, deps = []) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const latest = useRef(0);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(fn, deps);

  const reload = useCallback(async () => {
    const id = ++latest.current;
    try {
      setError('');
      const result = await run();
      if (id === latest.current) setData(result);
    } catch (e) {
      if (id === latest.current && e.status !== 401) setError(e.message);
    } finally {
      if (id === latest.current) setLoading(false);
    }
  }, [run]);

  useEffect(() => {
    setLoading(true);
    reload();
  }, [reload]);

  return { data, loading, error, reload, setData };
}
