// The top of the data screen: where the numbers are reliable and where to use them with care, each in a
// number and a line; the detail is in its row below, a click away.

import type { ReactNode } from 'react';
import type { Finding } from '../../../src/findings/cases';
import type { Note } from '../../../src/model/model';
import type { NoteSignal } from '../../../src/risk/notes';
import { count, usd } from '../../../src/shared/format';
import { sumMoney } from '../../../src/shared/money';

type Tone = 'trust' | 'caution';

function Highlight({
  tone,
  title,
  value,
  children,
  onSelect,
}: {
  tone: Tone;
  title: string;
  value: string;
  children: ReactNode;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="flex flex-col rounded-xl border border-hairline bg-surface p-5 text-left transition-colors hover:border-baseline"
    >
      <p className="flex items-center gap-1.5 font-medium text-ink-secondary text-xs">
        <span style={{ color: tone === 'trust' ? 'var(--color-good)' : 'var(--color-risk-medium)' }}>
          {tone === 'trust' ? '✓' : '⚠'}
        </span>
        {tone === 'trust' ? 'Reliable' : 'Use with care'}
      </p>
      <h2 className="mt-2 font-medium">{title}</h2>
      <p className="mt-3 font-semibold text-3xl tracking-tight">{value}</p>
      <p className="mt-2 text-ink-secondary text-sm">{children}</p>
      <p className="mt-auto pt-3 text-series-1 text-xs">See the cases ↓</p>
    </button>
  );
}

export function Highlights({
  findings,
  notes,
  signals,
  onSelect,
}: {
  findings: Finding[];
  notes: Note[];
  signals: NoteSignal[];
  onSelect: (findingId: string) => void;
}) {
  const findingOf = (id: string) => findings.find((f) => f.id === id);
  const linked = notes.filter((n) => n.customerId !== null).length;
  const unlinked = notes.filter((n) => n.customerId === null);
  const prospectIds = new Set(signals.filter((s) => s.noteType === 'prospect').map((s) => s.noteId));
  const prospects = unlinked.filter((n) => prospectIds.has(n.id)).length;
  const linkedShare = notes.length === 0 ? 0 : Math.round((linked / notes.length) * 100);
  const duplicates = findingOf('duplicateInvoices');
  const voided = findingOf('voidedInvoices');
  const setAside = sumMoney([duplicates?.amount ?? 0, voided?.amount ?? 0]);
  const under = findingOf('contractsBilledUnder');
  const uncovered = findingOf('notesCoverage');

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Highlight
        tone="trust"
        title="Billing counts what is real"
        value={`${usd(setAside)} set aside`}
        onSelect={() => onSelect('duplicateInvoices')}
      >
        Duplicate copies and voided invoices do not count.
      </Highlight>
      <Highlight
        tone="trust"
        title="Notes reach their customer"
        value={`${linkedShare}%`}
        onSelect={() => onSelect('unlinkedNotes')}
      >
        Of the {unlinked.length} left, {prospects} are prospects, not customers yet.
      </Highlight>
      <Highlight
        tone="caution"
        title="Contracts under their value"
        value={usd(Math.abs(under?.amount ?? 0))}
        onSelect={() => onSelect('contractsBilledUnder')}
      >
        {count(under?.cases.length ?? 0, 'contract')} in force: work not invoiced, or cancellations nobody recorded.
      </Highlight>
      <Highlight
        tone="caution"
        title="Customers without notes"
        value={`${uncovered?.cases.length ?? 0} customers`}
        onSelect={() => onSelect('notesCoverage')}
      >
        No note in a year: their risk comes from billing alone.
      </Highlight>
    </div>
  );
}
