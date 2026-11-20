import { useCallback, useEffect, useState } from 'react';
import * as api from './api.js';

// Loads the product list once and exposes reload() for after add/update/delete
export function useProducts() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const reload = useCallback(async () => {
    try {
      setError('');
      setProducts(await api.getProducts());
    } catch (e) {
      if (e.status !== 401) setError(`Could not load products. Is the Flask backend running? (${e.message})`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return { products, loading, error, reload };
}
