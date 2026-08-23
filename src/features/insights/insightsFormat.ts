export function formatInsightsAvg(n: number | null, digits = 1): string {
  if (n == null) return '—';
  return Number.isInteger(n) ? String(n) : n.toFixed(digits);
}
