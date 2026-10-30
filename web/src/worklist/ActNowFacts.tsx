// What to know about the customers to act on now, beyond their number: how concentrated the money at stake
// is, how pressing their contracts are, and who owns them.

import type { CustomerAssessment } from '../../../src/risk/worklist';
import { count, usd } from '../../../src/shared/format';
import { sumMoney } from '../../../src/shared/money';
import { contractEnd } from './labels';

export function ActNowFacts({ customers }: { customers: CustomerAssessment[] }) {
  const amounts = customers.map((c) => c.amountAtStake);
  const total = sumMoney(amounts);
  const [largest] = [...customers].sort((a, b) => b.amountAtStake - a.amountAtStake);
  const largestShare = total === 0 || !largest ? 0 : Math.round((largest.amountAtStake / total) * 100);
  const days = customers.map((c) => c.renewal?.daysToEnd ?? null);
  const ended = days.filter((d) => d !== null && d < 0).length;
  const endingSoon = days.filter((d) => d !== null && d >= 0 && d <= 90).length;
  const owners = ownersOf(customers);
  const largestEnd = contractEnd(largest?.renewal ?? null);

  return (
    <div>
      <p className="text-lg">
        <span className="font-semibold">{count(customers.length, 'customer')}</span>
        <span className="text-ink-secondary"> · </span>
        <span className="font-semibold">{usd(total)}</span>
        <span className="text-ink-secondary"> billed in the last twelve months</span>
      </p>
      <dl className="mt-4 space-y-2.5 border-hairline border-t pt-3 text-sm">
        {largest && (
          <Fact term="Largest">
            <span className="font-medium">{largest.name}</span>, {largestShare}% of it ({usd(largest.amountAtStake)}).{' '}
            {largestEnd.date}
            {largestEnd.distance && `, ${largestEnd.distance}`}.
          </Fact>
        )}
        <Fact term="Contracts">
          {ended} already ended, {endingSoon} end within 90 days.
        </Fact>
        <Fact term="Owners">
          {owners.map(([owner, own], i) => (
            <span key={owner}>
              {i > 0 && ' · '}
              {owner} <span className="text-ink-muted">{own.length}</span>
            </span>
          ))}
        </Fact>
      </dl>
    </div>
  );
}

function Fact({ term, children }: { term: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[5.5rem_1fr] gap-3">
      <dt className="text-ink-muted">{term}</dt>
      <dd>{children}</dd>
    </div>
  );
}

/** Owners with their customers, the most money at stake first; customers without one under "No owner". */
function ownersOf(customers: CustomerAssessment[]): [string, CustomerAssessment[]][] {
  const byOwner = new Map<string, CustomerAssessment[]>();
  for (const c of customers) {
    const owner = c.accountManagers.length > 0 ? c.accountManagers.join(' / ') : 'No owner';
    const own = byOwner.get(owner) ?? [];
    own.push(c);
    byOwner.set(owner, own);
  }
  const stake = (own: CustomerAssessment[]) => {
    const amounts = own.map((c) => c.amountAtStake);
    return sumMoney(amounts);
  };
  return [...byOwner].sort(([, a], [, b]) => stake(b) - stake(a));
}
