// The bridge from one half to the next, as a list and its detail: the steps on the left, one always
// selected, and the customers behind the selected step on the right. Each step is a bar growing left (less
// billing) or right (more), with its amount written out.

import { useState } from 'react';
import type { Bridge, BridgeKind, BridgeStep } from '../../../src/billing/bridge';
import type { CustomerRecord } from '../../../src/model/model';
import { count, usd } from '../../../src/shared/format';
import { sumMoney } from '../../../src/shared/money';
import { Change } from '../components/Change';

const STEP_LABELS: Record<BridgeKind, string> = {
  stopped: 'Stopped billing',
  less: 'Billed less',
  more: 'Billed more',
  new: 'New customers',
};

/** Movers listed before "show all". */
const FIRST_MOVERS = 8;

const signed = (amount: number) => (amount > 0 ? `+${usd(amount)}` : usd(amount));

export function BridgeView({ bridge, customers }: { bridge: Bridge; customers: CustomerRecord[] }) {
  // The step that moved billing the most is open from the start, so the detail is there without a click.
  const largestStep = [...bridge.steps].sort((a, b) => Math.abs(b.change) - Math.abs(a.change))[0];
  const [selected, setSelected] = useState<BridgeKind>(largestStep.kind);
  const names = new Map(customers.map((c) => [c.id, c.name]));
  const largest = Math.abs(largestStep.change);
  const change = sumMoney([bridge.current, -bridge.previous]);
  const changePct = bridge.previous === 0 ? null : (change / bridge.previous) * 100;
  const step = bridge.steps.find((s) => s.kind === selected) ?? largestStep;

  return (
    <div className="grid gap-6 md:grid-cols-[20rem_1fr]">
      <div>
        <p className="mb-3 text-sm">
          {usd(bridge.previous)} <span className="text-ink-muted">→</span> {usd(bridge.current)}{' '}
          <Change pct={changePct} className="text-ink-secondary" />
        </p>
        <div role="tablist" aria-label="Bridge steps" className="space-y-1">
          {bridge.steps.map((s) => (
            <StepButton
              key={s.kind}
              step={s}
              largest={largest}
              selected={s.kind === selected}
              onSelect={() => setSelected(s.kind)}
            />
          ))}
        </div>
      </div>
      <MoverList key={step.kind} step={step} names={names} />
    </div>
  );
}

function StepButton({
  step,
  largest,
  selected,
  onSelect,
}: {
  step: BridgeStep;
  largest: number;
  selected: boolean;
  onSelect: () => void;
}) {
  const share = largest === 0 ? 0 : (Math.abs(step.change) / largest) * 50;
  const color = step.change < 0 ? 'var(--color-down)' : 'var(--color-up)';
  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      onClick={onSelect}
      className={`w-full rounded-lg border px-3 py-2.5 text-left transition-colors ${selected ? 'border-baseline bg-surface shadow-sm' : 'border-transparent hover:border-hairline hover:bg-surface/60'}`}
    >
      <span className="flex items-baseline justify-between gap-2 text-sm">
        <span className={selected ? 'font-medium' : 'text-ink-secondary'}>
          {STEP_LABELS[step.kind]}
          <span className="ml-1.5 text-ink-muted text-xs">{step.movers.length}</span>
        </span>
        <span className="flex items-center gap-2">
          <span className={`tabular-nums ${selected ? 'font-semibold' : 'text-ink-secondary'}`}>
            {signed(step.change)}
          </span>
          <span aria-hidden className={`text-xs ${selected ? 'text-ink' : 'text-ink-muted'}`}>
            ›
          </span>
        </span>
      </span>
      <span className="relative mt-2 block h-1.5">
        <span className="absolute inset-y-0 left-1/2 w-px bg-baseline" />
        <span
          className="absolute inset-y-0 rounded-full"
          style={{
            width: `${share}%`,
            ...(step.change < 0 ? { right: '50%' } : { left: '50%' }),
            background: color,
            opacity: selected ? 1 : 0.5,
          }}
        />
      </span>
    </button>
  );
}

function MoverList({ step, names }: { step: BridgeStep; names: Map<string, string> }) {
  const [showAll, setShowAll] = useState(false);
  const shown = showAll ? step.movers : step.movers.slice(0, FIRST_MOVERS);
  const anyAtypical = step.movers.some((m) => m.atypicalChange !== 0);
  return (
    <div className="rounded-xl border border-hairline bg-surface p-5" role="tabpanel">
      <p className="text-sm">
        <span className="font-medium">{STEP_LABELS[step.kind]}</span>
        <span className="text-ink-secondary">
          {' '}
          · {count(step.movers.length, 'customer')} · {signed(step.change)}
        </span>
      </p>
      <div className={showAll ? 'mt-3 max-h-96 overflow-y-auto' : 'mt-3'}>
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-surface text-left text-ink-muted text-xs">
            <tr>
              <th className="py-1.5 font-normal">Customer</th>
              <th className="py-1.5 text-right font-normal">Before</th>
              <th className="py-1.5 text-right font-normal">After</th>
              <th className="py-1.5 text-right font-normal">Change</th>
              {anyAtypical && <th className="py-1.5 text-right font-normal">Of it, atypical</th>}
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {shown.map((m) => (
              <tr key={m.customerId ?? 'none'} className="border-hairline border-t">
                <td className="py-1.5">
                  {m.customerId === null ? 'Invoices with no customer' : (names.get(m.customerId) ?? m.customerId)}
                </td>
                <td className="py-1.5 text-right text-ink-secondary">{usd(m.previous)}</td>
                <td className="py-1.5 text-right text-ink-secondary">{usd(m.current)}</td>
                <td className="py-1.5 text-right font-medium">{signed(m.change)}</td>
                {anyAtypical && (
                  <td className="py-1.5 text-right text-ink-secondary">
                    {m.atypicalChange === 0 ? '–' : signed(m.atypicalChange)}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {step.movers.length > FIRST_MOVERS && (
        <button
          type="button"
          onClick={() => setShowAll(!showAll)}
          className="mt-3 text-series-1 text-sm hover:underline"
        >
          {showAll ? 'Show fewer' : `Show all ${step.movers.length}`}
        </button>
      )}
    </div>
  );
}
