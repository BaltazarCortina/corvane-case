// One customer, over whatever screen it was opened from: where it stands and why, its story with the notes
// and facts it cites, the notes themselves, and the data findings that touch it. Closes with Escape, the
// close button or a click outside.

import { useEffect } from 'react';
import { describeCase, type Finding, findingsAbout } from '../../../src/findings/cases';
import type { CustomerRecord, Note } from '../../../src/model/model';
import type { NoteSignal } from '../../../src/risk/notes';
import type { CustomerAssessment, Worklist } from '../../../src/risk/worklist';
import { dayLabel } from '../../../src/shared/calendar';
import { usd } from '../../../src/shared/format';
import type { CustomerStory } from '../../../src/stories/stories';
import { useResource } from '../api';
import { Change } from '../components/Change';
import { RiskBadge } from '../components/RiskBadge';
import { WhenLoaded } from '../components/WhenLoaded';
import { closeCustomer } from '../route';
import { contractEnd, GROUP_LABELS, STOPPED_LABELS } from '../worklist/labels';
import { NoteList } from './NoteList';
import { StoryView } from './StoryView';

export function CustomerPanel({ customerId }: { customerId: string }) {
  const worklist = useResource<Worklist>('worklist');
  const customers = useResource<CustomerRecord[]>('customers');
  const notes = useResource<Note[]>('notes');
  const signals = useResource<NoteSignal[]>('note-signals');
  const stories = useResource<CustomerStory[]>('stories');
  const findings = useResource<Finding[]>('findings');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closeCustomer();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="fixed inset-0 z-30 flex justify-end">
      <button type="button" aria-label="Close" onClick={closeCustomer} className="absolute inset-0 bg-ink/20" />
      <aside
        aria-label="Customer"
        className="relative h-full w-full max-w-2xl overflow-y-auto border-hairline border-l bg-surface shadow-xl"
      >
        <WhenLoaded resources={[worklist, customers, notes, signals, stories, findings]}>
          {(w: Worklist, c: CustomerRecord[], n: Note[], s: NoteSignal[], st: CustomerStory[], f: Finding[]) => {
            const assessment = w.customers.find((a) => a.customerId === customerId);
            const customer = c.find((r) => r.id === customerId);
            if (!assessment || !customer) return <p className="p-6 text-ink-secondary">No customer {customerId}.</p>;
            const own = n.filter((note) => note.customerId === customerId);
            const story = st.find((x) => x.customerId === customerId) ?? null;
            return (
              <Panel
                customer={customer}
                assessment={assessment}
                worklist={w}
                notes={own}
                signals={s}
                story={story}
                findings={findingsAbout(f, customerId)}
              />
            );
          }}
        </WhenLoaded>
      </aside>
    </div>
  );
}

function Panel({
  customer,
  assessment,
  worklist,
  notes,
  signals,
  story,
  findings,
}: {
  customer: CustomerRecord;
  assessment: CustomerAssessment;
  worklist: Worklist;
  notes: Note[];
  signals: NoteSignal[];
  story: CustomerStory | null;
  findings: ReturnType<typeof findingsAbout>;
}) {
  const { risk, renewal } = assessment;
  const place = [customer.industry, customer.city, customer.state].filter((v) => v !== null).join(' · ');
  const owner = customer.accountManagers.length > 0 ? customer.accountManagers.join(' / ') : 'No owner';
  const { date, distance } = contractEnd(renewal);
  const { declineWindow } = worklist;
  const numbers = noteNumbers(notes);

  return (
    <div className="space-y-8 p-6">
      <header>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-semibold text-2xl">{customer.name}</h2>
            <p className="mt-1 text-ink-muted text-sm">
              {place} · {owner}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {assessment.group && (
              <span className="rounded-full border border-baseline px-2.5 py-0.5 font-medium text-xs">
                {GROUP_LABELS[assessment.group]}
              </span>
            )}
            <button
              type="button"
              onClick={closeCustomer}
              aria-label="Close"
              className="rounded-md px-2 py-1 text-ink-muted hover:bg-page hover:text-ink"
            >
              ✕
            </button>
          </div>
        </div>
        <p className="mt-4 text-sm">
          <RiskBadge level={risk.level} suffix=" risk" />
          <span className="text-ink-secondary"> · {risk.reason}</span>
        </p>
        <p className="mt-1 text-ink-secondary text-sm">{statusLine(assessment)}</p>
      </header>

      <div className="grid grid-cols-3 gap-3">
        <Stat label="At stake">
          {usd(assessment.amountAtStake)}
          <span className="block font-normal text-ink-muted text-xs">
            {assessment.status === 'stopped'
              ? `12 months to its last invoice, ${dayLabel(assessment.stakePeriod.end)}`
              : 'Last 12 months, without atypical invoices'}
          </span>
        </Stat>
        <Stat label={`${declineWindow.current.label} vs ${declineWindow.previous.label}`}>
          <Change pct={risk.decline.changePct} />
        </Stat>
        <Stat label={renewal ? `Contract ${renewal.contractId}` : 'Contract'} small>
          {date}
          <span className="block font-normal text-ink-muted text-xs">
            {[distance, renewal?.autoRenew ? 'renews by itself' : null].filter(Boolean).join(' · ')}
          </span>
        </Stat>
      </div>

      {story ? (
        <StoryView story={story} notes={notes} numbers={numbers} />
      ) : (
        <p className="text-ink-muted text-sm">
          No story: they are written for customers in Act now, Monitor and Win back that have notes.
        </p>
      )}

      <NoteList notes={notes} signals={signals} numbers={numbers} />

      {findings.length > 0 && (
        <section>
          <h3 className="mb-2 font-semibold">Data findings</h3>
          <ul className="space-y-2 text-sm">
            {findings.map(({ finding, cases }) => (
              <li key={finding.id} className="rounded-lg border border-hairline p-3">
                <p className="font-medium">{finding.title}</p>
                {cases.map((c) => (
                  <p key={c.key} className="mt-0.5 text-ink-secondary">
                    {describeCase(c, customer.name)}
                  </p>
                ))}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

/** The notes numbered oldest first, so the numbers read in the order things happened. */
function noteNumbers(notes: Note[]): Map<string, number> {
  const oldestFirst = [...notes].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  const entries = oldestFirst.map((n, i): [string, number] => [n.id, i + 1]);
  return new Map(entries);
}

function statusLine(a: CustomerAssessment): string {
  if (a.status === 'neverBilled') return 'Never billed';
  if (a.status === 'billing') return `Still billing · last invoice ${a.lastInvoice}`;
  const why = a.stopped ? ` · ${STOPPED_LABELS[a.stopped.reason]}` : '';
  return `Stopped billing · last invoice ${a.lastInvoice}${why}`;
}

function Stat({ label, small = false, children }: { label: string; small?: boolean; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-hairline p-3">
      <p className="text-ink-muted text-xs">{label}</p>
      <p className={`mt-1 font-semibold ${small ? 'text-sm' : 'text-xl'}`}>{children}</p>
    </div>
  );
}
