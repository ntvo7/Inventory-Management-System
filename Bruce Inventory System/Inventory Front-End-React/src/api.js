// Calls to the Flask backend. Vite proxies /api to http://127.0.0.1:5000 (see vite.config.js),
// so the browser never talks to Flask directly and Flask needs no CORS changes.

async function request(method, body) {
  const res = await fetch('/api/stock', {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const data = await res.json();
      detail = data.detail || data.error || detail;
    } catch {
      /* response wasn't JSON */
    }
    throw new Error(`Server error ${res.status}: ${detail}`);
  }
  return method === 'GET' ? res.json() : res.text();
}

export const getProducts = () => request('GET');
export const addProduct = (product) => request('POST', product);
export const updateProduct = (product) => request('PUT', product);
export const deleteProduct = (s_id) => request('DELETE', { s_id });

export const CATEGORIES = ['Beverage', 'Snack', 'Alcohol', 'Cigarette', 'Other'];

// Links in the sidebar that aren't converted yet go to the existing EJS site.
export const OLD_SITE = 'http://127.0.0.1:9000';

// Same filtering rules as server.js /filter_products
export function filterProducts(products, name, category) {
  const n = name.trim().toLowerCase();
  const c = category.toLowerCase();
  return products.filter(
    (p) =>
      (!n || p.s_name.toLowerCase().includes(n)) &&
      (!c || (p.s_category || '').toLowerCase() === c)
  );
}

export const formatPrice = (price) => `$${Number(price).toFixed(2)}`;
