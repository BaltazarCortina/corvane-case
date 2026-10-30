// What a finding is: its impact when it is an assumption, and the single cases it lists, with helpers to
// describe them.

import type { Rule, RuleName } from '../model/assumptions';
import type { Invoice, Model } from '../model/model';
import { usd } from '../shared/format';

/** A measure as it stands, and as it would be if the rule were reversed. */
export interface Impact {
  measure: string;
  unit: 'percent' | 'count';
  asConfigured: number | null;
  ifReversed: number | null;
}

export interface Finding {
  id: string;
  kind: 'assumption' | 'observation';
  /** Observations worth checking with Corvane come before the informative ones. */
  worthChecking: boolean;
  title: string;
  summary: string;
  /** For assumptions: the rule in `config/assumptions.yml` behind it. */
  rule: (Pick<Rule, 'applies' | 'status' | 'basis'> & { name: RuleName }) | null;
  impact: Impact | null;
  amount: number | null;
  cases: FindingCase[];
}

export interface FindingCase {
  /** The key that identifies the case in `config/assumptions.yml`, or a stable id. */
  key: string;
  label: string;
  customerId: string | null;
  amount: number | null;
  detail: string | null;
}

/** Findings about how a name or a row was exported, which say nothing about the account. */
const NOT_ABOUT_THE_ACCOUNT = ['duplicateInvoices', 'shortenedNoteNames', 'nameVariants'];

/** The findings that say something about one customer's account, each with the cases that are its own. */
export function findingsAbout(findings: Finding[], customerId: string): { finding: Finding; cases: FindingCase[] }[] {
  const relevant = findings.filter((f) => !NOT_ABOUT_THE_ACCOUNT.includes(f.id));
  const withCases = relevant.map((finding) => {
    const cases = finding.cases.filter((c) => c.customerId === customerId);
    return { finding, cases };
  });
  return withCases.filter((f) => f.cases.length > 0);
}

/** The key of an invoice case: its source and number. */
const INVOICE_KEY = /^(quickbooks|netsuite):/;

/**
 * One case of a finding, as told about its own customer: "NS-INV-1 on 2026-07-02, $7k" for an invoice,
 * whose detail is its date; "CTR-6079: Contract ended 2026-05-31" for anything else, which explains itself.
 */
export function describeCase(c: FindingCase, customerName: string): string {
  const parts = c.label.split(' · ').filter((part) => part !== customerName);
  const label = parts.join(' · ') || c.label;
  if (INVOICE_KEY.test(c.key)) return `${label} on ${c.detail}, ${usd(c.amount ?? 0)}`;
  return c.detail ? `${label}: ${c.detail.replace(/\.$/, '')}` : label;
}

export function customerNames(model: Model): Map<string, string> {
  const entries = model.customers.map((c): [string, string] => [c.id, c.name]);
  return new Map(entries);
}

export function invoiceCase(invoice: Invoice, names: Map<string, string>): FindingCase {
  const customer = invoice.customerId ? names.get(invoice.customerId) : invoice.customerAsExported;
  return {
    key: invoice.key,
    label: `${invoice.number} · ${customer}`,
    customerId: invoice.customerId,
    amount: invoice.amount,
    detail: invoice.date,
  };
}
