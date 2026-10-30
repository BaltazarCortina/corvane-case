// The facts a customer story is written from, computed by code and numbered (F1, F2...) so the story can
// cite them and the verifier can check what it says against them. Numbers are written the way the app
// writes them, so a number copied from a fact matches it exactly.

import type { BillingAnalysis } from '../billing/analyze';
import { type BilledInvoice, byServiceLine, change } from '../billing/billing';
import type { Finding } from '../findings/cases';
import type { Contract, CustomerRecord } from '../model/model';
import type { CustomerAssessment } from '../risk/worklist';
import { monthLabel, monthOf, monthsBetween, type Period } from '../shared/calendar';
import { percent, usd } from '../shared/format';
import { sumMoney } from '../shared/money';

export interface Fact {
  id: string;
  text: string;
}

/** Findings about how a name or a row was exported, which say nothing about the account. */
const NOT_ABOUT_THE_ACCOUNT = ['duplicateInvoices', 'shortenedNoteNames', 'nameVariants'];

/** The key of an invoice case: its source and number. */
const INVOICE_KEY = /^(quickbooks|netsuite):/;

/** At most this many cases of one finding are spelled out; the rest are counted. */
const CASES_PER_FINDING = 5;

export interface FactSources {
  customer: CustomerRecord;
  assessment: CustomerAssessment;
  contract: Contract | null;
  /** The customer's invoices that count. */
  invoices: BilledInvoice[];
  billing: BillingAnalysis;
  findings: Finding[];
  stoppedBillingDays: number;
}

export function storyFacts(sources: FactSources): Fact[] {
  const texts = [
    profileFact(sources),
    statusFact(sources),
    riskFact(sources),
    contractFact(sources),
    stakeFact(sources),
    ...billingFacts(sources),
    ...findingFacts(sources),
  ];
  return texts.map((text, i) => ({ id: `F${i + 1}`, text }));
}

function profileFact({ customer }: FactSources): string {
  const place = [customer.industry, customer.city, customer.state].filter((v) => v !== null).join(', ');
  const managers = customer.accountManagers;
  const owner = managers.length === 0 ? 'no account manager in the CRM' : `account manager ${managers.join(' and ')}`;
  const since = customer.created ? `customer since ${customer.created}` : 'not in the CRM';
  return `${customer.name}: ${place || 'industry and location unknown'}; ${owner}; ${since}.`;
}

function statusFact({ assessment, billing, stoppedBillingDays }: FactSources): string {
  const { status, lastInvoice, stopped } = assessment;
  if (status === 'billing') return `Still billing: last invoice on ${lastInvoice}; the data runs to ${billing.asOf}.`;
  const why = {
    confirmedInNotes: `the notes confirm it (${stopped?.noteId})`,
    contractActive: 'the contract is still in force, so it may be work not invoiced or a cancellation nobody recorded',
    unknown: 'the data does not say why',
  };
  const reason = stopped ? `; ${why[stopped.reason]}` : '';
  return `Stopped billing: no invoice in the last ${stoppedBillingDays} days, the last on ${lastInvoice}${reason}.`;
}

function riskFact({ assessment }: FactSources): string {
  const { risk } = assessment;
  return `Risk level ${risk.level}, from the worst note of the last twelve months and the billing decline: ${risk.reason}.`;
}

function contractFact({ contract, assessment }: FactSources): string {
  if (!contract) return 'No contract on file.';
  const value = contract.annualValue === null ? 'annual value not recorded' : `${usd(contract.annualValue)} a year`;
  const days = assessment.renewal?.daysToEnd ?? null;
  const end = contractEnd(contract, days);
  const autoRenew = autoRenewal(contract.autoRenew);
  return `Contract ${contract.id}: ${value}, from ${contract.start}; ${end}; ${autoRenew}.`;
}

function contractEnd(contract: Contract, daysToEnd: number | null): string {
  if (contract.end === null || daysToEnd === null) {
    return `end date unknown (exported as ${contract.endAsExported}, before the start)`;
  }
  if (daysToEnd < 0) return `ended on ${contract.end}, ${-daysToEnd} days ago, with no newer contract on file`;
  if (daysToEnd === 0) return `ends on ${contract.end}, the day the data runs to`;
  return `ends on ${contract.end}, in ${daysToEnd} days`;
}

function autoRenewal(autoRenew: boolean | null): string {
  if (autoRenew === null) return 'auto-renewal not recorded';
  return autoRenew ? 'renews automatically' : 'does not renew automatically';
}

function stakeFact({ assessment, billing }: FactSources): string {
  const amount = usd(assessment.amountAtStake);
  if (assessment.status === 'stopped') {
    return `Amount at stake: ${amount}, billed without atypical invoices in the twelve months up to the last invoice.`;
  }
  const period = billing.twelveMonths.window.current;
  return `Amount at stake: ${amount}, billed without atypical invoices in the ${period.label}.`;
}

/** The two windows, the service lines and the months, all without atypical invoices. */
function billingFacts({ invoices, billing }: FactSources): string[] {
  const typical = invoices.filter((i) => !i.atypical);
  const half = billing.half.window;
  const twelve = billing.twelveMonths.window;
  const lines = byServiceLine(typical, half);
  const lineText = lines.map((l) => `${l.serviceLine} ${usd(l.previous)} → ${usd(l.current)}`).join('; ');
  const months = monthsBetween(half.previous.start, billing.asOf);
  const monthText = months.map((m) => {
    const inMonth = typical.filter((i) => monthOf(i.date) === m).map((i) => i.amount);
    return `${monthLabel(m)} ${usd(sumMoney(inMonth))}`;
  });
  return [
    `Billing without atypical invoices, ${comparison(typical, half.previous, half.current)}.`,
    `Billing without atypical invoices, ${comparison(typical, twelve.previous, twelve.current)}.`,
    `By service line, ${half.previous.label} → ${half.current.label}: ${lineText || 'no billing'}.`,
    `Monthly billing without atypical invoices: ${monthText.join(', ')}.`,
  ];
}

function comparison(invoices: BilledInvoice[], previous: Period, current: Period): string {
  const billed = change(invoices, { previous, current });
  const variation = billed.changePct === null ? 'no billing to compare with' : percent(billed.changePct);
  return `${previous.label} ${usd(billed.previous)}, ${current.label} ${usd(billed.current)} (${variation})`;
}

/** One fact per data finding about this customer, so the story does not read a data problem as a loss. */
function findingFacts({ customer, findings }: FactSources): string[] {
  const relevant = findings.filter((f) => !NOT_ABOUT_THE_ACCOUNT.includes(f.id));
  const facts: string[] = [];
  for (const finding of relevant) {
    const cases = finding.cases.filter((c) => c.customerId === customer.id);
    if (cases.length === 0) continue;
    const shown = cases.slice(0, CASES_PER_FINDING).map((c) => {
      const label = withoutName(c.label, customer.name);
      // An invoice case has its date as detail and its amount; any other case explains itself in the detail.
      const isInvoice = INVOICE_KEY.test(c.key);
      if (isInvoice) return `${label} on ${c.detail}, ${usd(c.amount ?? 0)}`;
      return c.detail ? `${label}: ${c.detail.replace(/\.$/, '')}` : label;
    });
    const more = cases.length - shown.length;
    const rest = more > 0 ? `; and ${more} more` : '';
    facts.push(`Data finding, ${finding.title}: ${shown.join('; ')}${rest}.`);
  }
  return facts;
}

/** A case label without the customer's name, which the story already knows: "CTR-6079", not "Acme · CTR-6079". */
function withoutName(label: string, name: string): string {
  const parts = label.split(' · ').filter((part) => part !== name);
  return parts.join(' · ') || label;
}
