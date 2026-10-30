// What a finding is: its impact when it is an assumption, and the single cases it lists, with helpers to
// describe them.

import type { Rule, RuleName } from '../model/assumptions';
import type { Invoice, Model } from '../model/model';

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
  rule: (Pick<Rule, 'applies' | 'confirmed' | 'basis'> & { name: RuleName }) | null;
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
