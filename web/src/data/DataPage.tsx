// Which numbers can be relied on and where the data may be wrong. That first; then what is pending with
// Corvane, the calls we made on the evidence, and what else the data shows, out of the way.

import { useState } from 'react';
import type { BillingAnalysis } from '../../../src/billing/analyze';
import type { Finding } from '../../../src/findings/cases';
import type { CustomerRecord, Note } from '../../../src/model/model';
import type { NoteSignal } from '../../../src/risk/notes';
import { useResource } from '../api';
import { InfoTip } from '../components/InfoTip';
import { Section } from '../components/Section';
import { WhenLoaded } from '../components/WhenLoaded';
import { FindingRow } from './FindingRow';
import { Highlights } from './Highlights';
import { ourCalls, pendingWithCorvane } from './pending';

export function DataPage() {
  const findings = useResource<Finding[]>('findings');
  const notes = useResource<Note[]>('notes');
  const signals = useResource<NoteSignal[]>('note-signals');
  const billing = useResource<BillingAnalysis>('billing');
  const customers = useResource<CustomerRecord[]>('customers');
  return (
    <WhenLoaded resources={[findings, notes, signals, billing, customers]}>
      {(f: Finding[], n: Note[], s: NoteSignal[], b: BillingAnalysis, c: CustomerRecord[]) => (
        <DataHealth findings={f} notes={n} signals={s} billing={b} customers={c} />
      )}
    </WhenLoaded>
  );
}

function DataHealth({
  findings,
  notes,
  signals,
  billing,
  customers,
}: {
  findings: Finding[];
  notes: Note[];
  signals: NoteSignal[];
  billing: BillingAnalysis;
  customers: CustomerRecord[];
}) {
  const names = new Map(customers.map((c) => [c.id, c.name]));
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());
  const pending = pendingWithCorvane(findings);
  const settled = ourCalls(findings);
  const informative = findings.filter((f) => f.kind === 'observation' && !f.worthChecking);

  const toggle = (id: string) => {
    const next = new Set(openIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setOpenIds(next);
  };
  const show = (id: string) => {
    setOpenIds(new Set(openIds).add(id));
    const row = document.getElementById(`finding-${id}`);
    row?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  const row = (f: Finding, compact = false) => (
    <FindingRow
      key={f.id}
      finding={f}
      signals={signals}
      names={names}
      compact={compact}
      open={openIds.has(f.id)}
      onToggle={() => toggle(f.id)}
    />
  );

  return (
    <div className="space-y-10">
      <header>
        <h1 className="font-semibold text-2xl">Data</h1>
        <p className="mt-1 text-ink-secondary text-sm">
          Which numbers you can rely on and where the data may be wrong · data to {billing.asOf}
        </p>
      </header>

      <Highlights findings={findings} notes={notes} signals={signals} onSelect={show} />

      <Section
        title={
          <>
            Open questions <span className="font-normal text-ink-muted">{pending.length}</span>
            <InfoTip term="open questions">
              What only Corvane can settle: assumptions we could not decide from the data, each with what the numbers
              would be the other way, and questions the data raises. Those that move the billing figures come first.
            </InfoTip>
          </>
        }
      >
        <div className="divide-y divide-hairline rounded-xl border border-hairline bg-surface">
          {pending.map((f) => row(f))}
        </div>
      </Section>

      <Section
        title={
          <>
            Assumptions <span className="font-normal text-ink-muted">{settled.length}</span>
            <InfoTip term="assumptions">
              Where the data allows more than one reading and the evidence is strong enough to decide: the rule we
              chose, the evidence, and what the numbers would be the other way. Corvane can still overturn any of them.
            </InfoTip>
          </>
        }
      >
        <div className="divide-y divide-hairline rounded-xl border border-hairline bg-surface">
          {settled.map((f) => row(f, true))}
        </div>
      </Section>

      <Section title="Other findings">
        <div className="divide-y divide-hairline rounded-xl border border-hairline bg-surface">
          {informative.map((f) => row(f, true))}
        </div>
      </Section>
    </div>
  );
}
