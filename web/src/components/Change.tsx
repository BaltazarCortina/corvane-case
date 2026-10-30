import { percent } from '../../../src/shared/format';

/** A change with its sign and an arrow, so its direction never depends on color alone. */
export function Change({ pct, className = '' }: { pct: number | null; className?: string }) {
  const arrow = pct === null || pct === 0 ? '' : pct > 0 ? '▲' : '▼';
  return (
    <span className={className}>
      {arrow && <span className="mr-1 text-[0.7em]">{arrow}</span>}
      {percent(pct)}
    </span>
  );
}
