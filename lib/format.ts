export const mxn = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
  maximumFractionDigits: 0
});

export function formatCurrency(value: number): string {
  return mxn.format(Number.isFinite(value) ? value : 0);
}

export function formatPercent(value: number): string {
  return `${value.toFixed(2)}%`;
}

export function formatMonthsToYears(months: number): string {
  const years = Math.floor(months / 12);
  const remMonths = months % 12;
  return `${years} años ${remMonths} meses`;
}
