// Net billings: invoiced amounts that count, net of credit memos, by invoice date. Never called revenue:
// the exports have invoice dates, not the dates the service was delivered.

import type { Parameters } from '../model/assumptions';
import type { Invoice, Model } from '../model/model';
import {
  addDays,
  contains,
  monthEnd,
  monthOf,
  monthsBetween,
  type Period,
  twelveMonthsTo,
  type Window,
} from '../shared/calendar';
import { groupBy } from '../shared/collections';
import { sumMoney } from '../shared/money';

/** An invoice that counts toward billing, and whether it is atypical for its customer. */
export interface BilledInvoice extends Invoice {
  atypical: boolean;
}

export interface Change {
  current: number;
  previous: number;
  change: number;
  /** Null when the previous amount is zero. */
  changePct: number | null;
}

export interface WindowComparison {
  window: Window;
  total: Change;
  withoutAtypical: Change;
  /** True when one side has invoices from the old billing system and the other from the new one. */
  crossesSystemChange: boolean;
}

export interface MonthPoint {
  month: string;
  total: number;
  withoutAtypical: number;
  /** The as-of date falls before the end of this month. */
  partial: boolean;
}

export interface LineTotal {
  serviceLine: string;
  current: number;
  previous: number;
}

export interface OpenAmount {
  amount: number;
  share: number;
}

export type BillingStatus = 'billing' | 'stopped' | 'neverBilled';

/** The date of the latest of the invoices, or null when there are none. */
export function lastInvoiceOf(invoices: Invoice[]): string | null {
  const dates = invoices.map((i) => i.date).sort();
  return dates.at(-1) ?? null;
}

/** Billing when the last invoice is recent enough; stopped otherwise. */
export function billingStatus(lastInvoice: string | null, asOf: string, parameters: Parameters): BillingStatus {
  if (lastInvoice === null) return 'neverBilled';
  const recently = addDays(asOf, -parameters.stoppedBillingDays);
  return lastInvoice >= recently ? 'billing' : 'stopped';
}

/** What a customer is worth: its typical billing over twelve months, and which twelve months. */
export interface Stake {
  amount: number;
  /**
   * The last twelve months while the customer bills; once it stopped, the twelve months up to its last
   * invoice, which is what was lost. Not the last twelve months of the data then.
   */
  period: Period;
}

/**
 * A customer's amount at stake: what it billed without atypical invoices over the last twelve months or,
 * once it stopped billing, over the twelve months up to its last invoice. `own` is its invoices that count.
 */
export function amountAtStake(own: BilledInvoice[], asOf: string, parameters: Parameters): Stake {
  const lastInvoice = lastInvoiceOf(own);
  const status = billingStatus(lastInvoice, asOf, parameters);
  const end = status === 'stopped' && lastInvoice ? lastInvoice : asOf;
  const period = twelveMonthsTo(end);
  const typical = own.filter((i) => !i.atypical);
  return { amount: totalIn(typical, period), period };
}

/** The invoices that count, each marked atypical or not. */
export function billedInvoices(model: Model, parameters: Parameters): BilledInvoice[] {
  const counted = model.invoices.filter((i) => i.excludedBy === null);
  const averageMonth = averageMonthByCustomer(counted);
  return counted.map((invoice) => {
    const customerAverage = averageMonth.get(invoice.customerId) ?? 0;
    const atypical = isAtypical(invoice, customerAverage, parameters);
    return { ...invoice, atypical };
  });
}

/**
 * Atypical for its customer: not one of the excluded service lines, at least the minimum amount, and at
 * least the multiple of what the customer bills in an average month.
 */
function isAtypical(invoice: Invoice, customerAverageMonth: number, parameters: Parameters): boolean {
  const excludedLine = parameters.atypicalInvoiceExcludedLines.includes(invoice.serviceLine ?? '');
  if (excludedLine) return false;
  if (invoice.amount < parameters.atypicalInvoiceMinimum) return false;
  return invoice.amount >= parameters.atypicalInvoiceMultiple * customerAverageMonth;
}

/** Each customer's billing divided by the months from its first invoice to its last. */
function averageMonthByCustomer(invoices: Invoice[]): Map<string | null, number> {
  const byCustomer = groupBy(invoices, (i) => i.customerId);
  const averages = new Map<string | null, number>();
  for (const [customerId, own] of byCustomer) {
    const dates = own.map((i) => i.date).sort();
    const months = monthsBetween(dates[0], dates[dates.length - 1]);
    const amounts = own.map((i) => i.amount);
    const total = sumMoney(amounts);
    averages.set(customerId, total / months.length);
  }
  return averages;
}

export function totalIn(invoices: BilledInvoice[], period: Period): number {
  const inPeriod = invoices.filter((i) => contains(period, i.date));
  const amounts = inPeriod.map((i) => i.amount);
  return sumMoney(amounts);
}

export function compareWindow(invoices: BilledInvoice[], window: Window, systemChange: string): WindowComparison {
  const typical = invoices.filter((i) => !i.atypical);
  const total = change(invoices, window);
  const withoutAtypical = change(typical, window);
  const crossesSystemChange = window.previous.start < systemChange && window.current.end >= systemChange;
  return { window, total, withoutAtypical, crossesSystemChange };
}

/** The billing of the invoices in both periods of the window, and how it changed. */
export function change(invoices: BilledInvoice[], window: Window): Change {
  const current = totalIn(invoices, window.current);
  const previous = totalIn(invoices, window.previous);
  const difference = sumMoney([current, -previous]);
  const changePct = previous === 0 ? null : (difference / previous) * 100;
  return { current, previous, change: difference, changePct };
}

/** The first day the new billing system has invoices for. */
export function systemChangeDate(invoices: Invoice[]): string {
  const netsuiteDates = invoices.filter((i) => i.source === 'netsuite').map((i) => i.date);
  return netsuiteDates.sort()[0];
}

/** The line credit memos are reported under, whatever service line the billing system gave them. */
export const CREDIT_MEMOS = 'Credit memos';

/**
 * Billing by service line in both periods, leaving out lines with none in either. Credit memos are a line
 * of their own: QuickBooks gives them no service line, so keeping the one NetSuite gives them would
 * make the lines incomparable across the system change.
 */
export function byServiceLine(invoices: BilledInvoice[], window: Window): LineTotal[] {
  const byLine = groupBy(invoices, (i) => (i.amount < 0 ? CREDIT_MEMOS : (i.serviceLine ?? 'Unclassified')));
  const lines: LineTotal[] = [];
  for (const [serviceLine, own] of byLine) {
    const current = totalIn(own, window.current);
    const previous = totalIn(own, window.previous);
    if (current === 0 && previous === 0) continue;
    lines.push({ serviceLine, current, previous });
  }
  return lines.sort((a, b) => b.current - a.current);
}

export function monthlySeries(invoices: BilledInvoice[], asOf: string): MonthPoint[] {
  const dates = invoices.map((i) => i.date).sort();
  const byMonth = groupBy(invoices, (i) => monthOf(i.date));
  const asOfMonth = monthOf(asOf);
  const asOfMonthIsPartial = asOf < monthEnd(asOf);
  return monthsBetween(dates[0], asOf).map((month) => {
    const own = byMonth.get(month) ?? [];
    const amounts = own.map((i) => i.amount);
    const typicalAmounts = own.filter((i) => !i.atypical).map((i) => i.amount);
    return {
      month,
      total: sumMoney(amounts),
      withoutAtypical: sumMoney(typicalAmounts),
      partial: month === asOfMonth && asOfMonthIsPartial,
    };
  });
}

/**
 * How much of a period's billing was still open (not collected) when the data was exported. Only the
 * new billing system keeps collection status up to date, so null when the period has none of its invoices.
 */
export function openAmount(invoices: BilledInvoice[], period: Period): OpenAmount | null {
  const tracked = invoices.filter((i) => i.source === 'netsuite' && contains(period, i.date));
  if (tracked.length === 0) return null;
  const open = tracked.filter((i) => i.status === 'open');
  const openAmounts = open.map((i) => i.amount);
  const trackedAmounts = tracked.map((i) => i.amount);
  const amount = sumMoney(openAmounts);
  const total = sumMoney(trackedAmounts);
  return { amount, share: total === 0 ? 0 : amount / total };
}
