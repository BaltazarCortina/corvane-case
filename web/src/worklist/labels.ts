// How the worklist's groups, reasons and contract dates are named on screen.

import type { Reason } from '../../../src/risk/scale';
import type { Renewal, StoppedReason, WorklistGroup } from '../../../src/risk/worklist';

export const GROUP_LABELS: Record<WorklistGroup, string> = {
  actNow: 'Act now',
  renewals: 'Renewals',
  monitor: 'Monitor',
  winBack: 'Win back',
};

export const REASON_LABELS: Record<Reason, string> = {
  service: 'Service problems',
  competitor: 'Competitor',
  price: 'Price',
  billing: 'Billing disputes',
  other: 'Other',
};

export const STOPPED_LABELS: Record<StoppedReason, string> = {
  confirmedInNotes: 'Leaving confirmed in the notes',
  contractActive: 'Contract still in force',
  unknown: 'Reason unknown',
};

/** The contract end as a date and how far it is: "Ends 2026-10-31", "in 31 days". */
export function contractEnd(renewal: Renewal | null): { date: string; distance: string | null } {
  if (!renewal) return { date: 'No contract on file', distance: null };
  if (renewal.end === null || renewal.daysToEnd === null) return { date: 'End date unknown', distance: null };
  const days = renewal.daysToEnd;
  if (days < 0) return { date: `Ended ${renewal.end}`, distance: `${-days} days ago` };
  if (days === 0) return { date: `Ends ${renewal.end}`, distance: 'today' };
  return { date: `Ends ${renewal.end}`, distance: `in ${days} days` };
}
