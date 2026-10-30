import { percent, usd } from '../../../src/shared/format';

/** The color of a change: green up, red down, ink when it did not move. */
function toneOf(value: number | null): string {
  if (value === null || value === 0) return '';
  return value > 0 ? 'text-up-text' : 'text-down-text';
}

/** A percentage change with its sign and an arrow, so its direction never depends on color alone. */
export function Change({ pct, className = '' }: { pct: number | null; className?: string }) {
  const arrow = pct === null || pct === 0 ? '' : pct > 0 ? '▲' : '▼';
  return (
    <span className={`${toneOf(pct)} ${className}`}>
      {arrow && <span className="mr-1 text-[0.7em]">{arrow}</span>}
      {percent(pct)}
    </span>
  );
}

/** An amount that went up or down, with its sign: `+$64k`, `−$789k`. */
export function ChangeAmount({ amount, className = '' }: { amount: number; className?: string }) {
  const text = amount > 0 ? `+${usd(amount)}` : usd(amount);
  return <span className={`${toneOf(amount)} ${className}`}>{text}</span>;
}
