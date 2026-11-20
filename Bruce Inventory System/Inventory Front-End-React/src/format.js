// Number, money and date formatting used across the app

const moneyFmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const moneyShort = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const numFmt = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 });

export const money = (n) => moneyFmt.format(Number(n) || 0);
export const moneyRound = (n) => moneyShort.format(Number(n) || 0);
export const num = (n) => numFmt.format(Number(n) || 0);
export const pct = (part, whole) => (whole ? `${Math.round((part / whole) * 100)}%` : '0%');

// "2026-11-20" or "2026-11-20T14:05:00" -> local date (date-only strings are read as calendar days)
function toDate(value) {
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  return new Date(value);
}
export const date = (v) => (v ? toDate(v).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—');
export const shortDate = (v) => (v ? toDate(v).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '');
export const dateTime = (v) =>
  v ? toDate(v).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—';

// YYYY-MM-DD for <input type="date">
export function ymd(d = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
export function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return ymd(d);
}

// stock status: same rule everywhere (and in the backend reports)
export function stockStatus(onHand, minStock) {
  if (Number(onHand) <= 0) return 'out';
  if (Number(onHand) < Number(minStock ?? 10)) return 'low';
  return 'ok';
}
export const STATUS_LABEL = { ok: 'Healthy', low: 'Low stock', out: 'Out of stock' };

export const initials = (name = '') =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('') || '?';
