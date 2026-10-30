// Billing by month or by quarter: typical billing with atypical invoices stacked on top, the two halves
// compared shaded, a partial month or quarter marked, and the month the billing system changed when the
// chart reaches back past it. The same numbers are one click away as a table.

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
import { addMonths, monthLabel, monthOf, type Period, rangeLabel, type Window } from '../../../src/shared/calendar';
import { usd } from '../../../src/shared/format';
import { sumMoney } from '../../../src/shared/money';

interface Row {
  /** The first and last month the bar covers: the same month, or the three months of a quarter. */
  first: string;
  last: string;
  /** The label on the axis, short where room is short; the title, in full, in the tooltip and the table. */
  label: string;
  title: string;
  typical: number;
  atypical: number;
  total: number;
  partial: boolean;
}

export function MonthlyChart({
  months,
  systemChange,
  window,
  compact = false,
  by = 'month',
}: {
  months: MonthPoint[];
  systemChange: string;
  window: Window;
  /** Shorter, without the table view: for a glance on another screen. */
  compact?: boolean;
  /** One bar per month, or per quarter, the quarters aligned with the halves compared. */
  by?: 'month' | 'quarter';
}) {
  const [asTable, setAsTable] = useState(false);
  const monthRows: Row[] = months.map((m) => ({
    first: m.month,
    last: m.month,
    label: monthLabel(m.month),
    title: monthLabel(m.month),
    typical: m.withoutAtypical,
    atypical: sumMoney([m.total, -m.withoutAtypical]),
    total: m.total,
    partial: m.partial,
  }));
  const quarterStart = Number(window.current.start.slice(5, 7));
  const rows = by === 'quarter' ? byQuarter(monthRows, quarterStart) : monthRows;
  const unit = by === 'quarter' ? 'quarter' : 'month';
  // The system change is marked only when the chart shows months on both sides of it.
  const changeMonth = monthOf(systemChange);
  const changeRow = rows.findIndex((r) => r.first <= changeMonth && changeMonth <= r.last);
  const systemChangeLabel = changeRow > 0 ? rows[changeRow].label : null;
  const hasPartial = rows.some((r) => r.partial);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-4 text-ink-secondary text-xs">
        <LegendKey color="var(--color-series-1)" label="Typical billing" />
        <LegendKey color="var(--color-series-2)" label="Atypical invoices" />
        {hasPartial && <LegendKey color="var(--color-series-1)" faded label={`Partial ${unit}`} />}
        {!compact && (
          <button
            type="button"
            onClick={() => setAsTable(!asTable)}
            className="ml-auto rounded-md border border-hairline px-2 py-1 text-ink-secondary hover:bg-page"
          >
            {asTable ? 'Show chart' : 'Show table'}
          </button>
        )}
      </div>
      {asTable ? (
        <MonthTable rows={rows} unit={unit} />
      ) : (
        <Chart
          rows={rows}
          unit={unit}
          systemChangeLabel={systemChangeLabel}
          window={window}
          height={compact ? 280 : 240}
        />
      )}
    </div>
  );
}

function Chart({
  rows,
  unit,
  systemChangeLabel,
  window,
  height,
}: {
  rows: Row[];
  unit: string;
  systemChangeLabel: string | null;
  window: Window;
  height: number;
}) {
  const labelOf = (iso: string) => {
    const month = monthOf(iso);
    return rows.find((r) => r.first <= month && month <= r.last)?.label;
  };
  const area = (period: Period) => ({
    x1: labelOf(period.start),
    x2: labelOf(period.end),
    label: { value: period.label, position: 'top' as const, fill: 'var(--color-ink-secondary)', fontSize: 11 },
  });
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={rows} margin={{ top: 20, right: 8, bottom: 0, left: 0 }}>
        <ReferenceArea {...area(window.previous)} fill="var(--color-hairline)" fillOpacity={0.5} />
        <ReferenceArea {...area(window.current)} fill="var(--color-hairline)" fillOpacity={0.5} />
        <CartesianGrid vertical={false} stroke="var(--color-hairline)" />
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={{ stroke: 'var(--color-baseline)' }}
          tick={{ fill: 'var(--color-ink-muted)', fontSize: 11 }}
          interval={unit === 'quarter' ? 0 : 2}
        />
        <YAxis
          tickFormatter={(v: number) => usd(v)}
          tickLine={false}
          axisLine={false}
          tick={{ fill: 'var(--color-ink-muted)', fontSize: 11 }}
          width={56}
        />
        <Tooltip cursor={{ fill: 'var(--color-hairline)', fillOpacity: 0.5 }} content={<MonthTooltip unit={unit} />} />
        {systemChangeLabel && (
          <ReferenceLine
            x={systemChangeLabel}
            position="start"
            stroke="var(--color-ink-muted)"
            label={{ value: 'NetSuite', position: 'insideTopLeft', fill: 'var(--color-ink-muted)', fontSize: 11 }}
          />
        )}
        <Bar
          dataKey="typical"
          stackId="month"
          fill="var(--color-series-1)"
          maxBarSize={unit === 'quarter' ? 36 : 24}
          isAnimationActive={false}
          radius={[4, 4, 0, 0]}
          stroke="var(--color-surface)"
          strokeWidth={1}
        >
          {rows.map((r) => (
            <Cell key={r.first} fillOpacity={r.partial ? 0.45 : 1} />
          ))}
        </Bar>
        <Bar
          dataKey="atypical"
          stackId="month"
          fill="var(--color-series-2)"
          maxBarSize={unit === 'quarter' ? 36 : 24}
          isAnimationActive={false}
          radius={[4, 4, 0, 0]}
          stroke="var(--color-surface)"
          strokeWidth={1}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

function MonthTooltip({ active, payload, unit }: { active?: boolean; payload?: { payload: Row }[]; unit: string }) {
  const row = payload?.[0]?.payload;
  if (!active || !row) return null;
  return (
    <div className="rounded-md border border-hairline bg-surface px-3 py-2 text-xs shadow-sm">
      <p className="font-medium text-ink">
        {row.title}
        {row.partial && ` · partial ${unit}`}
      </p>
      <p className="mt-1 text-ink-secondary">Typical {usd(row.typical)}</p>
      {row.atypical !== 0 && <p className="text-ink-secondary">Atypical {usd(row.atypical)}</p>}
      <p className="text-ink">Total {usd(row.total)}</p>
    </div>
  );
}

function MonthTable({ rows, unit }: { rows: Row[]; unit: string }) {
  return (
    <table className="w-full text-sm">
      <thead className="text-left text-ink-muted text-xs">
        <tr>
          <th className="py-1 font-normal">{unit === 'quarter' ? 'Quarter' : 'Month'}</th>
          <th className="py-1 text-right font-normal">Typical</th>
          <th className="py-1 text-right font-normal">Atypical</th>
          <th className="py-1 text-right font-normal">Total</th>
        </tr>
      </thead>
      <tbody className="tabular-nums">
        {rows.map((r) => (
          <tr key={r.first} className="border-hairline border-t">
            <td className="py-1">
              {r.title}
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

/**
 * Months summed into quarters, each starting at the month the halves start at, or three or six months on,
 * so a quarter never straddles two halves. A quarter the data does not cover in full is partial.
 */
function byQuarter(months: Row[], startMonth: number): Row[] {
  const quarterOf = (month: string) => {
    const offset = (Number(month.slice(5, 7)) - startMonth + 12) % 3;
    const firstDay = addMonths(`${month}-01`, -offset);
    return monthOf(firstDay);
  };
  const quarters = new Map<string, Row[]>();
  for (const m of months) {
    const first = quarterOf(m.first);
    const own = quarters.get(first) ?? [];
    own.push(m);
    quarters.set(first, own);
  }
  return [...quarters].map(([first, own]) => {
    const lastDay = addMonths(`${first}-01`, 2);
    const last = monthOf(lastDay);
    const typical = own.map((m) => m.typical);
    const atypical = own.map((m) => m.atypical);
    const total = own.map((m) => m.total);
    return {
      first,
      last,
      label: rangeLabel(first, last, true),
      title: rangeLabel(first, last),
      typical: sumMoney(typical),
      atypical: sumMoney(atypical),
      total: sumMoney(total),
      partial: own.length < 3 || own.some((m) => m.partial),
    };
  });
}

function LegendKey({ color, label, faded = false }: { color: string; label: string; faded?: boolean }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="inline-block size-2.5 rounded-sm" style={{ background: color, opacity: faded ? 0.45 : 1 }} />
      {label}
    </span>
  );
}
