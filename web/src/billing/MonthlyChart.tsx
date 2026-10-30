// Billing by month: typical billing with atypical invoices stacked on top, the two halves compared shaded,
// a partial month marked, and the month the billing system changed. The same numbers are one click away as
// a table.

import { useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { MonthPoint } from '../../../src/billing/billing';
import { monthLabel, monthOf, type Period, type Window } from '../../../src/shared/calendar';
import { usd } from '../../../src/shared/format';
import { sumMoney } from '../../../src/shared/money';

interface Row {
  month: string;
  label: string;
  typical: number;
  atypical: number;
  total: number;
  partial: boolean;
}

export function MonthlyChart({
  months,
  systemChange,
  window,
}: {
  months: MonthPoint[];
  systemChange: string;
  window: Window;
}) {
  const [asTable, setAsTable] = useState(false);
  const rows: Row[] = months.map((m) => ({
    month: m.month,
    label: monthLabel(m.month),
    typical: m.withoutAtypical,
    atypical: sumMoney([m.total, -m.withoutAtypical]),
    total: m.total,
    partial: m.partial,
  }));
  const systemChangeLabel = monthLabel(monthOf(systemChange));
  const hasPartial = rows.some((r) => r.partial);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-4 text-ink-secondary text-xs">
        <LegendKey color="var(--color-series-1)" label="Typical billing" />
        <LegendKey color="var(--color-series-2)" label="Atypical invoices" />
        {hasPartial && <LegendKey color="var(--color-series-1)" faded label="Partial month" />}
        <button
          type="button"
          onClick={() => setAsTable(!asTable)}
          className="ml-auto rounded-md border border-hairline px-2 py-1 text-ink-secondary hover:bg-page"
        >
          {asTable ? 'Show chart' : 'Show table'}
        </button>
      </div>
      {asTable ? (
        <MonthTable rows={rows} />
      ) : (
        <Chart rows={rows} systemChangeLabel={systemChangeLabel} window={window} />
      )}
    </div>
  );
}

function Chart({ rows, systemChangeLabel, window }: { rows: Row[]; systemChangeLabel: string; window: Window }) {
  const area = (period: Period) => ({
    x1: monthLabel(monthOf(period.start)),
    x2: monthLabel(monthOf(period.end)),
    label: { value: period.label, position: 'top' as const, fill: 'var(--color-ink-secondary)', fontSize: 11 },
  });
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={rows} margin={{ top: 20, right: 8, bottom: 0, left: 0 }}>
        <ReferenceArea {...area(window.previous)} fill="var(--color-hairline)" fillOpacity={0.5} />
        <ReferenceArea {...area(window.current)} fill="var(--color-hairline)" fillOpacity={0.5} />
        <CartesianGrid vertical={false} stroke="var(--color-hairline)" />
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={{ stroke: 'var(--color-baseline)' }}
          tick={{ fill: 'var(--color-ink-muted)', fontSize: 11 }}
          interval={2}
        />
        <YAxis
          tickFormatter={(v: number) => usd(v)}
          tickLine={false}
          axisLine={false}
          tick={{ fill: 'var(--color-ink-muted)', fontSize: 11 }}
          width={56}
        />
        <Tooltip cursor={{ fill: 'var(--color-hairline)', fillOpacity: 0.5 }} content={<MonthTooltip />} />
        <ReferenceLine
          x={systemChangeLabel}
          stroke="var(--color-ink-muted)"
          label={{ value: 'NetSuite', position: 'insideTopLeft', fill: 'var(--color-ink-muted)', fontSize: 11 }}
        />
        <Bar
          dataKey="typical"
          stackId="month"
          fill="var(--color-series-1)"
          maxBarSize={24}
          isAnimationActive={false}
          radius={[4, 4, 0, 0]}
          stroke="var(--color-surface)"
          strokeWidth={1}
        >
          {rows.map((r) => (
            <Cell key={r.month} fillOpacity={r.partial ? 0.45 : 1} />
          ))}
        </Bar>
        <Bar
          dataKey="atypical"
          stackId="month"
          fill="var(--color-series-2)"
          maxBarSize={24}
          isAnimationActive={false}
          radius={[4, 4, 0, 0]}
          stroke="var(--color-surface)"
          strokeWidth={1}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

function MonthTooltip({ active, payload }: { active?: boolean; payload?: { payload: Row }[] }) {
  const row = payload?.[0]?.payload;
  if (!active || !row) return null;
  return (
    <div className="rounded-md border border-hairline bg-surface px-3 py-2 text-xs shadow-sm">
      <p className="font-medium text-ink">
        {row.label}
        {row.partial && ' · partial month'}
      </p>
      <p className="mt-1 text-ink-secondary">Typical {usd(row.typical)}</p>
      {row.atypical !== 0 && <p className="text-ink-secondary">Atypical {usd(row.atypical)}</p>}
      <p className="text-ink">Total {usd(row.total)}</p>
    </div>
  );
}

function MonthTable({ rows }: { rows: Row[] }) {
  return (
    <table className="w-full text-sm">
      <thead className="text-left text-ink-muted text-xs">
        <tr>
          <th className="py-1 font-normal">Month</th>
          <th className="py-1 text-right font-normal">Typical</th>
          <th className="py-1 text-right font-normal">Atypical</th>
          <th className="py-1 text-right font-normal">Total</th>
        </tr>
      </thead>
      <tbody className="tabular-nums">
        {rows.map((r) => (
          <tr key={r.month} className="border-hairline border-t">
            <td className="py-1">
              {r.label}
              {r.partial && <span className="text-ink-muted"> (partial)</span>}
            </td>
            <td className="py-1 text-right">{usd(r.typical)}</td>
            <td className="py-1 text-right">{r.atypical === 0 ? '–' : usd(r.atypical)}</td>
            <td className="py-1 text-right">{usd(r.total)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function LegendKey({ color, label, faded = false }: { color: string; label: string; faded?: boolean }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="inline-block size-2.5 rounded-sm" style={{ background: color, opacity: faded ? 0.45 : 1 }} />
      {label}
    </span>
  );
}
