// Why the customers in the worklist are at risk, as their notes say: one bar per reason, with the count
// written out. One series, so the bars are neutral and blue keeps meaning low risk on this screen.

import type { ReasonCount } from '../../../src/risk/worklist';
import { REASON_LABELS } from './labels';

export function ReasonsChart({ reasons }: { reasons: ReasonCount[] }) {
  const most = Math.max(1, ...reasons.map((r) => r.customers));
  if (reasons.length === 0) return <p className="mt-4 text-ink-muted text-sm">No note at risk in the period.</p>;
  return (
    <ul className="mt-4 space-y-2.5">
      {reasons.map((r) => (
        <li key={r.reason} className="grid grid-cols-[8.5rem_1fr_2rem] items-center gap-3 text-sm">
          <span className="text-ink-secondary">{REASON_LABELS[r.reason]}</span>
          <span className="h-2 rounded-full bg-hairline">
            <span
              className="block h-2 rounded-full bg-ink-secondary"
              style={{ width: `${(r.customers / most) * 100}%` }}
            />
          </span>
          <span className="text-right font-medium tabular-nums">{r.customers}</span>
        </li>
      ))}
    </ul>
  );
}
