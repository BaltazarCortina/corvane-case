// Billing by service line in the two halves, with the change written out.

import type { LineTotal } from '../../../src/billing/billing';
import type { Window } from '../../../src/shared/calendar';
import { usd } from '../../../src/shared/format';
import { sumMoney } from '../../../src/shared/money';
import { Change, ChangeAmount } from '../components/Change';

export function ServiceLines({ lines, window }: { lines: LineTotal[]; window: Window }) {
  const previous = sumMoney(lines.map((l) => l.previous));
  const current = sumMoney(lines.map((l) => l.current));
  const rows = [...lines, { serviceLine: 'Total', previous, current }];
  return (
    <table className="w-full text-sm">
      <thead className="text-left text-ink-muted text-xs">
        <tr>
          <th className="py-1 font-normal">Service line</th>
          <th className="py-1 text-right font-normal">{window.previous.label}</th>
          <th className="py-1 text-right font-normal">{window.current.label}</th>
          <th className="py-1 text-right font-normal">Change</th>
          <th className="py-1 text-right font-normal">%</th>
        </tr>
      </thead>
      <tbody className="tabular-nums">
        {rows.map((l) => {
          const change = sumMoney([l.current, -l.previous]);
          const changePct = l.previous === 0 ? null : (change / Math.abs(l.previous)) * 100;
          const isTotal = l.serviceLine === 'Total';
          return (
            <tr key={l.serviceLine} className={`border-hairline border-t ${isTotal ? 'font-medium' : ''}`}>
              <td className="py-1.5">{l.serviceLine}</td>
              <td className="py-1.5 text-right">{usd(l.previous)}</td>
              <td className="py-1.5 text-right">{usd(l.current)}</td>
              <td className="py-1.5 text-right">
                <ChangeAmount amount={change} />
              </td>
              <td className="py-1.5 text-right">
                <Change pct={changePct} />
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
