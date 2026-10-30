// Who to call and why. Every customer gets its billing status, risk level, renewal and amount at stake,
// and falls in at most one worklist group. Risk says how likely Corvane is to lose the customer, the
// renewal says when to act; they are kept apart and only meet in the group rules.

import type { BillingAnalysis } from '../billing/analyze';
import { type BilledInvoice, billedInvoices, groupBy } from '../billing/billing';
import type { Parameters } from '../model/assumptions';
import type { Contract, Model, Note } from '../model/model';
import {
  addDays,
  addMonths,
  contains,
  daysBetween,
  type Period,
  twelveMonthsTo,
  type Window,
} from '../shared/calendar';
import { sumMoney } from '../shared/money';
import { worstNoteByCustomer } from './noteRisk';
import type { NoteSignal } from './notes';
import { declineOf, type Risk, riskOf } from './risk';
import type { RiskLevel } from './scale';

export type WorklistGroup = 'actNow' | 'renewals' | 'monitor' | 'winBack';

/** The order the groups are shown in. They are assigned in another order: see `groupOf`. */
export const WORKLIST_GROUPS: WorklistGroup[] = ['actNow', 'renewals', 'monitor', 'winBack'];

export type BillingStatus = 'billing' | 'stopped' | 'neverBilled';

/** Why a customer stopped billing, as far as the data tells. */
export type StoppedReason = 'confirmedInNotes' | 'contractActive' | 'unknown';

export interface Renewal {
  contractId: string;
  /** Null when the contract end is unknown. */
  end: string | null;
  /** Days from the as-of date to the end, negative once it has ended. Null when the end is unknown. */
  daysToEnd: number | null;
  /** The current contract has ended and no newer one is on file. */
  expired: boolean;
  autoRenew: boolean | null;
}

export interface Stopped {
  reason: StoppedReason;
  /** The high-risk note that confirms it, when the notes do. */
  noteId: string | null;
}

export interface CustomerAssessment {
  customerId: string;
  name: string;
  accountManagers: string[];
  status: BillingStatus;
  lastInvoice: string | null;
  /** Only for a customer that stopped billing. */
  stopped: Stopped | null;
  risk: Risk;
  /** Null when the customer has no contract on file. */
  renewal: Renewal | null;
  /**
   * Billing over the last twelve months without atypical invoices; for a customer that stopped, over the
   * twelve months up to its last invoice.
   */
  amountAtStake: number;
  group: WorklistGroup | null;
  /** A renewal with no risk that renews by itself: nothing to do, so hidden by default. */
  healthyAutoRenewal: boolean;
}

export interface Worklist {
  asOf: string;
  /** The period the worst note is taken from. */
  notesPeriod: Period;
  /** The halves billing is compared between. */
  declineWindow: Window;
  /** Every customer, those in the worklist first, in the order they are shown. */
  customers: CustomerAssessment[];
}

export function buildWorklist(
  model: Model,
  billing: BillingAnalysis,
  signals: NoteSignal[],
  parameters: Parameters,
): Worklist {
  const { asOf } = billing;
  const lastTwelveMonths = billing.twelveMonths.window.current;
  const declineWindow = billing.half.window;
  const invoices = billedInvoices(model, parameters);
  const invoicesOf = groupBy(invoices, (i) => i.customerId);
  const notesOf = groupBy(model.notes, (n) => n.customerId);
  const worstNotes = worstNoteByCustomer(model.notes, signals, lastTwelveMonths);
  const contracts = new Map(model.contracts.map((c) => [c.id, c]));

  const customers = model.customers.map((customer) => {
    const own = invoicesOf.get(customer.id) ?? [];
    const typical = own.filter((i) => !i.atypical);
    const dates = own.map((i) => i.date).sort();
    const lastInvoice = dates.at(-1) ?? null;
    const status = statusOf(lastInvoice, asOf, parameters);
    const contract = customer.contractId ? contracts.get(customer.contractId) : undefined;
    const renewal = contract ? renewalOf(contract, asOf) : null;

    const previous = billedIn(typical, declineWindow.previous);
    const current = billedIn(typical, declineWindow.current);
    const decline = declineOf(previous, current, parameters);
    const worstNote = worstNotes.get(customer.id) ?? null;
    const risk = riskOf(worstNote, decline);

    const stakePeriod = status === 'stopped' && lastInvoice ? twelveMonthsTo(lastInvoice) : lastTwelveMonths;
    const amountAtStake = billedIn(typical, stakePeriod);
    const customerNotes = notesOf.get(customer.id) ?? [];
    const stopped =
      status === 'stopped' && lastInvoice
        ? stoppedOf(customer.id, lastInvoice, renewal, customerNotes, signals, asOf)
        : null;
    const group = groupOf({ status, lastInvoice, risk: risk.level, renewal }, asOf, parameters);
    const healthyAutoRenewal = group === 'renewals' && risk.level === 'none' && renewal?.autoRenew === true;
    return {
      customerId: customer.id,
      name: customer.name,
      accountManagers: customer.accountManagers,
      status,
      lastInvoice,
      stopped,
      risk,
      renewal,
      amountAtStake,
      group,
      healthyAutoRenewal,
    };
  });
  const sorted = customers.sort(byDisplayOrder);
  return { asOf, notesPeriod: lastTwelveMonths, declineWindow, customers: sorted };
}

function billedIn(invoices: BilledInvoice[], period: Period): number {
  const inPeriod = invoices.filter((i) => contains(period, i.date));
  const amounts = inPeriod.map((i) => i.amount);
  return sumMoney(amounts);
}

/** Billing when its last invoice is recent enough; stopped otherwise. */
function statusOf(lastInvoice: string | null, asOf: string, parameters: Parameters): BillingStatus {
  if (lastInvoice === null) return 'neverBilled';
  const recently = addDays(asOf, -parameters.stoppedBillingDays);
  return lastInvoice >= recently ? 'billing' : 'stopped';
}

function renewalOf(contract: Contract, asOf: string): Renewal {
  const daysToEnd = contract.end === null ? null : daysBetween(asOf, contract.end);
  return {
    contractId: contract.id,
    end: contract.end,
    daysToEnd,
    expired: daysToEnd !== null && daysToEnd < 0,
    autoRenew: contract.autoRenew,
  };
}

/**
 * Confirmed in the notes when a high-risk note was written in the twelve months before the last invoice
 * or since; otherwise, the contract is still in force; otherwise, unknown.
 */
function stoppedOf(
  customerId: string,
  lastInvoice: string,
  renewal: Renewal | null,
  notes: Note[],
  signals: NoteSignal[],
  asOf: string,
): Stopped {
  const since = twelveMonthsTo(lastInvoice).start;
  const period = { label: 'since a year before the last invoice', start: since, end: asOf };
  const worst = worstNoteByCustomer(notes, signals, period);
  const note = worst.get(customerId);
  if (note?.risk === 'high') return { reason: 'confirmedInNotes', noteId: note.noteId };
  const inForce = renewal !== null && renewal.end !== null && !renewal.expired;
  return { reason: inForce ? 'contractActive' : 'unknown', noteId: null };
}

export interface GroupInputs {
  status: BillingStatus;
  lastInvoice: string | null;
  risk: RiskLevel;
  renewal: Renewal | null;
}

/**
 * The first rule that matches: stopped billing recently → Win back; high risk, or medium risk with the
 * contract ending soon or ended → Act now; medium risk → Monitor; low or no risk with the contract ending
 * within the renewal horizon or ended → Renewals; low risk → Monitor. Win back comes first so that a
 * customer already lost does not crowd out those that can still be kept.
 */
export function groupOf(customer: GroupInputs, asOf: string, parameters: Parameters): WorklistGroup | null {
  const { status, lastInvoice, risk, renewal } = customer;
  if (status === 'neverBilled' || lastInvoice === null) return null;
  if (status === 'stopped') {
    const winBackFrom = addMonths(asOf, -parameters.winBackMonths);
    return lastInvoice >= winBackFrom ? 'winBack' : null;
  }
  const endsWithin = (days: number) => renewal?.daysToEnd != null && renewal.daysToEnd <= days;
  if (risk === 'high') return 'actNow';
  if (risk === 'medium' && endsWithin(parameters.actNowRenewalDays)) return 'actNow';
  if (risk === 'medium') return 'monitor';
  if (endsWithin(parameters.upcomingRenewalDays)) return 'renewals';
  if (risk === 'low') return 'monitor';
  return null;
}

/**
 * Groups in the order they are shown, then customers outside the worklist by name. Within a group, the
 * larger amount at stake first; renewals by end date, the ended ones first, like a calendar, and then by
 * amount at stake.
 */
function byDisplayOrder(a: CustomerAssessment, b: CustomerAssessment): number {
  const groupRank = (c: CustomerAssessment) =>
    c.group === null ? WORKLIST_GROUPS.length : WORKLIST_GROUPS.indexOf(c.group);
  const byGroup = groupRank(a) - groupRank(b);
  if (byGroup !== 0) return byGroup;
  if (a.group === null) return a.name.localeCompare(b.name);
  const endOf = (c: CustomerAssessment) => c.renewal?.daysToEnd ?? Number.POSITIVE_INFINITY;
  const byEnd = endOf(a) - endOf(b);
  if (a.group === 'renewals' && byEnd !== 0) return byEnd;
  return b.amountAtStake - a.amountAtStake;
}
