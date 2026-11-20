// Every call to the Flask backend. Vite forwards /api to http://127.0.0.1:5000 (vite.config.js),
// so the login cookie Flask sets belongs to this site.

let onUnauthorized = () => {};
// auth.jsx registers this: any "login required" answer sends the user back to the login page
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
    const message = (isJson && (data.error || data.detail)) || `Server error ${res.status}`;
    const err = new Error(message);
    err.status = res.status;
    throw err;
  }
  return data;
}

const get = (path) => request('GET', path);
const post = (path, body) => request('POST', path, body || {});
const put = (path, body) => request('PUT', path, body);
const del = (path, body) => request('DELETE', path, body);
const qs = (params) => {
  const s = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== '' && v != null)).toString();
  return s ? `?${s}` : '';
};

// login & users
export const me = () => request('GET', '/api/me', null, { quiet401: true });
export const login = (username, password) => request('POST', '/api/login', { username, password }, { quiet401: true });
export const logout = () => post('/api/logout');
export const changePassword = (current_password, new_password) => post('/api/me/password', { current_password, new_password });
export const getUsers = () => get('/api/users');
export const createUser = (user) => post('/api/users', user);
export const updateUser = (id, changes) => put(`/api/users/${id}`, changes);

// products & stock actions
export const getProducts = () => get('/api/stock');
export const addProduct = (product) => post('/api/stock', product);
export const updateProduct = (product) => put('/api/stock', product);
export const deleteProduct = (s_id) => del('/api/stock', { s_id });
export const receiveStock = (s_id, body) => post(`/api/stock/${s_id}/receive`, body);
export const sellStock = (s_id, body) => post(`/api/stock/${s_id}/sell`, body);
export const adjustStock = (s_id, body) => post(`/api/stock/${s_id}/adjust`, body);

// reports data
export const getValuation = () => get('/api/valuation');
export const getMovements = (filters = {}) => get(`/api/movements${qs(filters)}`);
export const getForecast = (days = 14) => get(`/api/forecast?days=${days}`);
export const getSalesReport = (start, end) => get(`/api/reports/sales${qs({ start, end })}`);

// suppliers & purchase orders
export const getSuppliers = () => get('/api/suppliers');
export const createSupplier = (s) => post('/api/suppliers', s);
export const updateSupplier = (id, s) => put(`/api/suppliers/${id}`, s);
export const deleteSupplier = (id) => del(`/api/suppliers/${id}`);
export const getPurchaseOrders = (status) => get(`/api/purchase_orders${qs({ status })}`);
export const getPurchaseOrder = (id) => get(`/api/purchase_orders/${id}`);
export const createPurchaseOrder = (po) => post('/api/purchase_orders', po);
export const setPurchaseOrderStatus = (id, status) => post(`/api/purchase_orders/${id}/status`, { status });
export const receivePurchaseOrder = (id) => post(`/api/purchase_orders/${id}/receive`);

export const CATEGORIES = ['Beverage', 'Snack', 'Alcohol', 'Cigarette', 'Other'];
export const UNITS = ['each', 'pack', 'case', 'bottle', 'can', 'carton', 'box'];
