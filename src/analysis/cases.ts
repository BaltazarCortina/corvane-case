// The single cases a finding lists, and helpers to describe them.

import type { Invoice, Model } from '../pipeline/model';

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
