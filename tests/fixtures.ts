// Builders for small inputs shared across tests.

import type { Assignment, Assumptions, Parameters, Rule } from '../src/pipeline/assumptions';
import { EXPORTS, type ExportName, parseCsv, type RawExports } from '../src/pipeline/exports';
import type { Invoice, Model } from '../src/pipeline/model';

/** The five exports from data lines; each export not given has only its header. */
export function exportsWith(lines: Partial<Record<ExportName, string[]>>): RawExports {
  const csv = (name: ExportName) => {
    const header = EXPORTS[name].columns.join(',');
    const rows = lines[name] ?? [];
    return [header, ...rows].join('\n');
  };
  const names = Object.keys(EXPORTS) as ExportName[];
  const entries = names.map((name) => {
    const text = csv(name);
    return [name, parseCsv(name, text)];
  });
  return Object.fromEntries(entries);
}

type RuleName = Exclude<keyof Assumptions, 'assignments' | 'parameters'>;

/** Every rule applied, unconfirmed and without exceptions, unless overridden. */
export function assumptionsWith(
  overrides: Partial<Record<RuleName, Partial<Rule>>> & {
    assignments?: Assignment[];
    parameters?: Partial<Parameters>;
  } = {},
): Assumptions {
  const rule = (name: RuleName): Rule => ({
    applies: true,
    confirmed: false,
    basis: '',
    exceptions: [],
    ...overrides[name],
  });
  return {
    parameters: {
      atypicalInvoiceExcludedLines: ['Inspection & Testing', 'Monitoring'],
      atypicalInvoiceMinimum: 100_000,
      atypicalInvoiceMultiple: 1.5,
      ...overrides.parameters,
    },
    duplicateCustomers: rule('duplicateCustomers'),
    shortenedNoteNames: rule('shortenedNoteNames'),
    duplicateInvoices: rule('duplicateInvoices'),
    voidedInvoices: rule('voidedInvoices'),
    creditMemos: rule('creditMemos'),
    impossibleContractDates: rule('impossibleContractDates'),
    assignments: overrides.assignments ?? [],
  };
}

/** A counted NetSuite invoice, with any field overridden. */
export function invoice(fields: Partial<Invoice> = {}): Invoice {
  return {
    key: 'netsuite:NS-1',
    source: 'netsuite',
    line: 2,
    number: 'NS-1',
    customerId: 'C-1',
    customerAsExported: 'C-1',
    date: '2025-04-01',
    amount: 100,
    serviceLine: 'Repair',
    status: 'paid',
    excludedBy: null,
    ...fields,
  };
}

/** A model holding only these invoices. */
export function modelWithInvoices(invoices: Invoice[]): Model {
  return {
    customers: [],
    invoices,
    contracts: [],
    notes: [],
    reconciliation: [],
    duplicateGroups: [],
    shortenedNames: [],
    unmapped: [],
    configProblems: [],
  };
}
