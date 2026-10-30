// One worklist group as a table: who owns the customer, why it is here, what is at stake and when its
// contract ends. Win back says why the customer stopped instead of its risk. A row opens the customer.

import type { CustomerAssessment, WorklistGroup } from '../../../src/risk/worklist';
import type { Window } from '../../../src/shared/calendar';
import { usd } from '../../../src/shared/format';
import { InfoTip } from '../components/InfoTip';
import { RiskBadge } from '../components/RiskBadge';
import { openCustomer } from '../route';
import { contractEnd, STOPPED_LABELS } from './labels';

export function WorklistTable({
  group,
  customers,
  declineWindow,
}: {
  group: WorklistGroup;
  customers: CustomerAssessment[];
  declineWindow: Window;
}) {
  const winBack = group === 'winBack';
  return (
    <div className="overflow-hidden rounded-xl border border-hairline bg-surface">
      <table className="w-full text-sm">
        <thead className="border-hairline border-b text-left text-ink-muted text-xs">
          <tr>
            <th className="px-4 py-2.5 font-normal">Customer</th>
            <th className="px-4 py-2.5 font-normal">Owner</th>
            <th className="px-4 py-2.5 font-normal">
              {winBack ? 'Why it stopped' : 'Risk and why'}
              {!winBack && (
                <InfoTip term="the risk level">
                  The worst account note of the last twelve months, as the AI read it, combined with the billing decline
                  from {declineWindow.previous.label} to {declineWindow.current.label}, without atypical invoices. A
                  high note, or billing down by half, is high risk on its own.
                </InfoTip>
              )}
            </th>
            <th className="px-4 py-2.5 text-right font-normal">
              At stake
              <InfoTip term="at stake">
                What the customer billed without atypical invoices over the last twelve months. For a customer that
                stopped billing, over the twelve months up to its last invoice: what was lost, not what it billed
                lately.
              </InfoTip>
            </th>
            <th className="px-4 py-2.5 font-normal">{winBack ? 'Last invoice' : 'Contract'}</th>
          </tr>
        </thead>
        <tbody>
          {customers.map((c) => (
            <tr
              key={c.customerId}
              onClick={() => openCustomer(c.customerId)}
              className="cursor-pointer border-hairline border-t align-top first:border-t-0 hover:bg-page"
            >
              <td className="px-4 py-3">
                <button
                  type="button"
                  onClick={() => openCustomer(c.customerId)}
                  className="text-left font-medium hover:underline"
                >
                  {c.name}
                </button>
              </td>
              <td className="px-4 py-3 text-ink-secondary">
                {c.accountManagers.length > 0 ? (
                  c.accountManagers.join(' / ')
                ) : (
                  <span className="text-ink-muted italic">No owner</span>
                )}
              </td>
              <td className="px-4 py-3">{winBack ? <StoppedCell customer={c} /> : <RiskCell customer={c} />}</td>
              <td className="px-4 py-3 text-right font-medium tabular-nums">
                {usd(c.amountAtStake)}
                {c.status === 'stopped' && (
                  <span className="block font-normal text-ink-muted text-xs">12 months to last invoice</span>
                )}
              </td>
              <td className="whitespace-nowrap px-4 py-3">
                {winBack ? <span className="text-ink-secondary">{c.lastInvoice}</span> : <ContractCell customer={c} />}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {customers.length === 0 && <p className="p-4 text-ink-muted text-sm">No customers in this group.</p>}
    </div>
  );
}

function RiskCell({ customer }: { customer: CustomerAssessment }) {
  return (
    <div>
      <RiskBadge level={customer.risk.level} />
      <p className="mt-0.5 text-ink-secondary text-xs">{customer.risk.reason}</p>
    </div>
  );
}

function StoppedCell({ customer }: { customer: CustomerAssessment }) {
  if (!customer.stopped) return null;
  return <span className="text-ink-secondary">{STOPPED_LABELS[customer.stopped.reason]}</span>;
}

function ContractCell({ customer }: { customer: CustomerAssessment }) {
  const { date, distance } = contractEnd(customer.renewal);
  return (
    <div>
      <p className="text-ink-secondary">{date}</p>
      <p className="text-ink-muted text-xs">
        {distance}
        {customer.renewal?.autoRenew && <span>{distance ? ' · ' : ''}renews by itself</span>}
      </p>
    </div>
  );
}
