// One finding as a row: closed, what it is, whether it is our assumption or a question for Corvane, how many
// cases and what it changes; open, what it says and the cases behind it, where a customer opens its panel.

import { useState } from 'react';
import type { Finding, FindingCase } from '../../../src/findings/cases';
import type { NoteSignal } from '../../../src/risk/notes';
import { count, percent, usd } from '../../../src/shared/format';
import { CustomerLink } from '../components/CustomerLink';
import { RiskBadge } from '../components/RiskBadge';

/** Cases listed before "show all". */
const FIRST_CASES = 10;

export function FindingRow({
  finding,
  signals,
  names,
  compact = false,
  open,
  onToggle,
}: {
  finding: Finding;
  signals: NoteSignal[];
  /** Customer names by id, for the cases that belong to a customer. */
  names: Map<string, string>;
  compact?: boolean;
  open: boolean;
  onToggle: () => void;
}) {
  const impact = impactText(finding);
  const cases = finding.cases.length;
  return (
    <div id={`finding-${finding.id}`} className="scroll-mt-6">
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        className="grid w-full grid-cols-[1rem_1fr_auto] items-baseline gap-3 px-5 py-3 text-left hover:bg-page"
      >
        <span aria-hidden className="text-ink-muted text-xs">
          {open ? '▾' : '▸'}
        </span>
        <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="font-medium">{finding.title}</span>
          {(finding.kind === 'assumption' || !compact) && (
            <span className="text-ink-muted text-xs">{kindLabel(finding)}</span>
          )}
          <span className="text-ink-muted text-xs">{count(cases, 'case')}</span>
        </span>
        {impact && (
          <span className="whitespace-nowrap text-right font-medium text-sm tabular-nums">{impact.value}</span>
        )}
      </button>
      {open && (
        <div className="space-y-3 px-5 pb-5 pl-12">
          <p className="max-w-3xl text-ink-secondary text-sm">
            {finding.summary}
            {impact?.measure && (
              <span className="text-ink-muted">
                {' '}
                ({impact.measure}: {impact.value})
              </span>
            )}
          </p>
          {finding.id === 'unlinkedNotes' ? (
            <UnlinkedNotes cases={finding.cases} signals={signals} />
          ) : (
            <CaseList cases={finding.cases} names={names} />
          )}
        </div>
      )}
    </div>
  );
}

const STATUS_LABELS = {
  decided: 'Decided',
  open: 'Open assumption',
  confirmed: 'Confirmed by Corvane',
} as const;

function kindLabel(f: Finding): string {
  if (f.kind === 'observation') return 'Question for Corvane';
  return f.rule ? STATUS_LABELS[f.rule.status] : '';
}

/** What the finding changes: the figure as it stands and the other way, or the money involved. */
function impactText(f: Finding): { value: string; measure: string | null } | null {
  const impact = f.impact;
  if (impact && impact.asConfigured !== null && impact.ifReversed !== null) {
    const now = impact.unit === 'percent' ? percent(impact.asConfigured) : String(impact.asConfigured);
    const other = impact.unit === 'percent' ? percent(impact.ifReversed) : String(impact.ifReversed);
    return { value: `${now} → ${other}`, measure: `${impact.measure}, the other way` };
  }
  if (f.amount !== null) return { value: usd(Math.abs(f.amount)), measure: 'involved' };
  return null;
}

/**
 * The cases as a table: the customer apart from the item (the contract, the invoice...) that the label joins
 * them in, the detail and the amount. With money involved, the largest amounts first.
 */
function CaseList({ cases, names }: { cases: FindingCase[]; names: Map<string, string> }) {
  const [showAll, setShowAll] = useState(false);
  const hasAmounts = cases.some((c) => c.amount !== null);
  const sorted = hasAmounts ? [...cases].sort((a, b) => Math.abs(b.amount ?? 0) - Math.abs(a.amount ?? 0)) : cases;
  const rows = sorted.map((c) => ({ ...c, ...splitLabel(c, names) }));
  const hasCustomers = rows.some((r) => r.customer !== null);
  const hasItems = rows.some((r) => r.item !== null);
  const hasDetails = rows.some((r) => r.detail !== null);
  const shown = showAll ? rows : rows.slice(0, FIRST_CASES);
  return (
    <div>
      <table className="w-full text-sm">
        <thead className="text-left text-ink-muted text-xs">
          <tr>
            {hasCustomers && <th className="py-1 pr-4 font-normal">Customer</th>}
            {hasItems && <th className="py-1 pr-4 font-normal">{hasCustomers ? 'Item' : 'Case'}</th>}
            {hasDetails && <th className="py-1 pr-4 font-normal">Detail</th>}
            {hasAmounts && <th className="py-1 text-right font-normal">Amount</th>}
          </tr>
        </thead>
        <tbody>
          {shown.map((r) => (
            <tr key={r.key} className="border-hairline border-t align-top">
              {hasCustomers && (
                <td className="whitespace-nowrap py-1.5 pr-4">
                  {r.customerId && r.customer ? (
                    <CustomerLink customerId={r.customerId}>{r.customer}</CustomerLink>
                  ) : (
                    ''
                  )}
                </td>
              )}
              {hasItems && <td className="whitespace-nowrap py-1.5 pr-4 text-ink-secondary">{r.item}</td>}
              {hasDetails && <td className="py-1.5 pr-4 text-ink-secondary">{r.detail?.replace(/\.$/, '')}</td>}
              {hasAmounts && (
                <td className="whitespace-nowrap py-1.5 text-right tabular-nums">
                  {r.amount === null ? '' : usd(r.amount)}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      {cases.length > FIRST_CASES && (
        <button
          type="button"
          onClick={() => setShowAll(!showAll)}
          className="mt-2 text-series-1 text-sm hover:underline"
        >
          {showAll ? 'Show fewer' : `Show all ${cases.length}`}
        </button>
      )}
    </div>
  );
}

/**
 * A case's label holds its customer and the item it is about, in either order ("Acme · CTR-1",
 * "NS-INV-1 · Acme"). The customer's name is taken out of it; what is left is the item.
 */
function splitLabel(c: FindingCase, names: Map<string, string>): { customer: string | null; item: string | null } {
  const customer = c.customerId ? (names.get(c.customerId) ?? null) : null;
  const parts = c.label.split(' · ').filter((part) => part !== customer);
  const item = parts.join(' · ');
  return { customer, item: item === '' ? null : item };
}

/** Notes no customer was found for: prospects are expected; any other name is still to resolve. */
function UnlinkedNotes({ cases, signals }: { cases: FindingCase[]; signals: NoteSignal[] }) {
  const signalOf = new Map(signals.map((s) => [s.noteId, s]));
  const isProspect = (c: FindingCase) => signalOf.get(c.key)?.noteType === 'prospect';
  const groups: [string, FindingCase[]][] = [
    ['Names to resolve', cases.filter((c) => !isProspect(c))],
    ['Prospects, not customers yet', cases.filter(isProspect)],
  ];
  return (
    <div className="space-y-3">
      {groups
        .filter(([, own]) => own.length > 0)
        .map(([title, own]) => (
          <div key={title}>
            <p className="font-medium text-ink-secondary text-xs uppercase tracking-wide">{title}</p>
            <ul className="mt-1 space-y-1.5 text-sm">
              {own.map((c) => {
                const risk = signalOf.get(c.key)?.risk ?? 'none';
                return (
                  <li key={c.key}>
                    <span className="font-medium">{c.label}</span>
                    {risk !== 'none' && (
                      <span className="ml-2">
                        <RiskBadge level={risk} suffix=" risk" />
                      </span>
                    )}
                    <span className="block text-ink-secondary">{c.detail}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
    </div>
  );
}
