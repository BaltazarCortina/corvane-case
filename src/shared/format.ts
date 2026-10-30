// Numbers as the app writes them in sentences.

/** `$801k`, `$1.1M`, `$950`. */
export function usd(amount: number): string {
  const sign = amount < 0 ? '−' : '';
  const absolute = Math.abs(amount);
  if (absolute >= 1_000_000) return `${sign}$${(absolute / 1_000_000).toFixed(1)}M`;
  if (absolute >= 1_000) return `${sign}$${Math.round(absolute / 1_000)}k`;
  return `${sign}$${Math.round(absolute)}`;
}

/** `+0.8%`, `−6.8%`, or `n/a` when there is nothing to compare with. */
export function percent(value: number | null): string {
  if (value === null) return 'n/a';
  const sign = value > 0 ? '+' : value < 0 ? '−' : '';
  return `${sign}${Math.abs(value).toFixed(1)}%`;
}

/** `1 invoice`, `45 invoices`. */
export function count(n: number, one: string, many = `${one}s`): string {
  const noun = n === 1 ? one : many;
  return `${n.toLocaleString('en-US')} ${noun}`;
}
