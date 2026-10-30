// Who to call and why. Act now leads, with why customers are at risk beside it; the four groups follow as
// tabs, each a table; a row opens the customer.

import { useState } from 'react';
import type { Parameters } from '../../../src/model/assumptions';
import { WORKLIST_GROUPS, type WorklistGroup } from '../../../src/risk/groups';
import type { CustomerAssessment, Worklist } from '../../../src/risk/worklist';
import { usd } from '../../../src/shared/format';
import { sumMoney } from '../../../src/shared/money';
import { useResource } from '../api';
import { InfoTip } from '../components/InfoTip';
import { WhenLoaded } from '../components/WhenLoaded';
import { ActNowFacts } from './ActNowFacts';
import { GROUP_LABELS } from './labels';
import { ReasonsChart } from './ReasonsChart';
import { WorklistTable } from './WorklistTable';

export function WorklistPage() {
  const worklist = useResource<Worklist>('worklist');
  const parameters = useResource<Parameters>('parameters');
  return (
    <WhenLoaded resources={[worklist, parameters]}>
      {(w: Worklist, p: Parameters) => <WorklistView worklist={w} parameters={p} />}
    </WhenLoaded>
  );
}

function WorklistView({ worklist, parameters }: { worklist: Worklist; parameters: Parameters }) {
  const [group, setGroup] = useState<WorklistGroup>('actNow');
  const [showHealthy, setShowHealthy] = useState(false);
  const inGroup = (g: WorklistGroup) => worklist.customers.filter((c) => c.group === g);
  const actNow = inGroup('actNow');
  const healthy = inGroup('renewals').filter((c) => c.healthyAutoRenewal).length;
  const shown = inGroup(group).filter((c) => showHealthy || !c.healthyAutoRenewal);

  return (
    <div className="space-y-10">
      <header>
        <h1 className="font-semibold text-2xl">Worklist</h1>
        <p className="mt-1 text-ink-secondary text-sm">
          Who to call and why · data to {worklist.asOf} · notes from {worklist.notesPeriod.start}
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-[3fr_2fr]">
        <section className="rounded-xl border border-hairline bg-surface p-6 shadow-sm">
          <h2 className="mb-3 font-medium text-ink-secondary text-sm">Act now</h2>
          <ActNowFacts customers={actNow} />
        </section>
        <section className="rounded-xl border border-hairline/70 bg-surface/60 p-6">
          <h2 className="font-medium text-ink-secondary text-sm">
            Why customers are at risk
            <InfoTip term="why customers are at risk">
              Customers in the worklist with a note at medium or high risk since {worklist.notesPeriod.start}, by the
              reason the note gives. A customer counts once per reason, and can have more than one.
            </InfoTip>
          </h2>
          <ReasonsChart reasons={worklist.reasons} />
        </section>
      </div>

      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div role="tablist" aria-label="Worklist groups" className="flex flex-wrap gap-1">
            {WORKLIST_GROUPS.map((g) => (
              <GroupTab
                key={g}
                group={g}
                customers={inGroup(g).filter((c) => !c.healthyAutoRenewal)}
                selected={g === group}
                onSelect={() => setGroup(g)}
              />
            ))}
            <InfoTip term="the worklist groups">
              Each customer is in one group, by the first rule it meets. Win back: stopped billing (no invoice in{' '}
              {parameters.stoppedBillingDays} days) within the last {parameters.winBackMonths} months. Act now: high
              risk, or medium risk with the contract ending within {parameters.actNowRenewalDays} days or ended.
              Monitor: medium risk. Renewals: low or no risk with the contract ending within{' '}
              {parameters.upcomingRenewalDays} days or ended. Monitor: low risk.
            </InfoTip>
          </div>
          {group === 'renewals' && healthy > 0 && (
            <label className="flex items-center gap-2 text-ink-secondary text-sm">
              <input type="checkbox" checked={showHealthy} onChange={(e) => setShowHealthy(e.target.checked)} />
              Show healthy auto-renewals ({healthy})
            </label>
          )}
        </div>
        <WorklistTable group={group} customers={shown} declineWindow={worklist.declineWindow} />
      </section>
    </div>
  );
}

function GroupTab({
  group,
  customers,
  selected,
  onSelect,
}: {
  group: WorklistGroup;
  customers: CustomerAssessment[];
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      onClick={onSelect}
      className={`rounded-lg border px-4 py-2 text-left ${selected ? 'border-baseline bg-surface shadow-sm' : 'border-transparent text-ink-secondary hover:bg-surface/60'}`}
    >
      <span className={`block text-sm ${selected ? 'font-semibold text-ink' : ''}`}>
        {GROUP_LABELS[group]} <span className="font-normal text-ink-muted">{customers.length}</span>
      </span>
      <span className="block text-ink-muted text-xs tabular-nums">{usd(stakeOf(customers))} at stake</span>
    </button>
  );
}

function stakeOf(customers: CustomerAssessment[]): number {
  const amounts = customers.map((c) => c.amountAtStake);
  return sumMoney(amounts);
}
