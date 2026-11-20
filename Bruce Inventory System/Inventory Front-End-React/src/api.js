// Calls to the Flask backend. Vite forwards /api to http://127.0.0.1:5000 (see vite.config.js),
// so the login cookie Flask sets belongs to this site and Flask needs no CORS changes.

let onUnauthorized = () => {};
// auth.jsx registers this so any "login required" answer sends the user back to the login page
export function setUnauthorizedHandler(fn) {
  onUnauthorized = fn;
}

async function request(method, path, body, { quiet401 = false } = {}) {
  const res = await fetch(path, {
    method,
    credentials: 'same-origin',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const isJson = (res.headers.get('content-type') || '').includes('application/json');
  const data = isJson ? await res.json() : await res.text();
  if (!res.ok) {
    if (res.status === 401 && !quiet401) onUnauthorized();
    const detail = (isJson && (data.detail || data.error)) || res.statusText;
    const err = new Error(res.status === 401 ? detail : `Server error ${res.status}: ${detail}`);
    err.status = res.status;
    throw err;
  }
  return data;
}

// login
export const me = () => request('GET', '/api/me', null, { quiet401: true });
export const login = (username, password) =>
  request('POST', '/api/login', { username, password }, { quiet401: true });
export const logout = () => request('POST', '/api/logout');

// products
export const getProducts = () => request('GET', '/api/stock');
export const addProduct = (product) => request('POST', '/api/stock', product);
export const updateProduct = (product) => request('PUT', '/api/stock', product);
export const deleteProduct = (s_id) => request('DELETE', '/api/stock', { s_id });

// history
export const getStockChanges = () => request('GET', '/api/stock_change');

export const CATEGORIES = ['Beverage', 'Snack', 'Alcohol', 'Cigarette', 'Other'];

// Products with fewer than this many on hand are "low stock" (same as server.js)
export const LOW_STOCK_THRESHOLD = 10;

// Same filtering rules as server.js
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

// Flask sends dates like "Sun, 03 Nov 2024 00:00:00 GMT"; these read them in UTC so the day never shifts
export const toYMD = (date) => new Date(date).toISOString().slice(0, 10);
export function formatDate(date) {
  const [y, m, d] = toYMD(date).split('-');
  return `${m}/${d}/${y}`;
}
