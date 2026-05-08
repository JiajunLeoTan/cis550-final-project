export function formatCurrency(value, { compact = false } = {}) {
  if (value == null || Number.isNaN(Number(value))) return '-';
  const num = Number(value);
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    notation: compact && Math.abs(num) >= 1000 ? 'compact' : 'standard',
    maximumFractionDigits: 2
  }).format(num);
}

export function isValidPrice(value) {
  if (value == null) return false;
  const n = Number(value);
  return Number.isFinite(n) && n > 0;
}

export function formatProductPrice(value) {
  return isValidPrice(value) ? formatCurrency(value) : 'Price unavailable';
}

export function formatStars(value) {
  if (value == null) return '-';
  const n = Number(value);
  if (Number.isNaN(n)) return '-';
  return n.toFixed(1);
}

export function formatCount(value) {
  if (value == null) return '0';
  const n = Number(value);
  if (Number.isNaN(n)) return '0';
  return new Intl.NumberFormat('en-US', { notation: n >= 10000 ? 'compact' : 'standard' }).format(n);
}

export function formatPercent(value, digits = 1) {
  if (value == null || Number.isNaN(Number(value))) return '-';
  return `${Number(value).toFixed(digits)}%`;
}

export function formatMonth(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
}

export function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function truncate(text, len = 120) {
  if (!text) return '';
  return text.length > len ? `${text.slice(0, len - 1)}...` : text;
}
