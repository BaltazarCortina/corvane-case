// The unified model: invoices from both billing systems in one table, contracts and notes, all linked
// to the customers they belong to. Every row is kept, and each invoice says whether it counts or which
// rule excludes it, so the totals can be reconciled with the exports rule by rule.

import { sumMoney } from '../shared/money';
import { type Assumptions, holds } from './assumptions';
import type { ContractRow, NetSuiteInvoice, ParsedExports, QuickBooksInvoice, UnmappedValue } from './parse';
import type { Customer, DuplicateGroup, NameLink, Resolution, ShortenedName } from './resolve';

export type Source = 'quickbooks' | 'netsuite';

/** Why an invoice does not count: an exact duplicate, voided, or a credit memo when credits are ignored. */
export type Exclusion = 'duplicate' | 'void' | 'credit';

export interface Invoice {
  /** The case key for exceptions: the source and the invoice number, e.g. "netsuite:NS-INV-51227". */
  key: string;
  source: Source;
  line: number;
  number: string;
  customerId: string | null;
  /** The customer as the export names it: a name in QuickBooks, an id in NetSuite. */
  customerAsExported: string;
  date: string;
  amount: number;
  serviceLine: string | null;
  /** The free-text description QuickBooks has instead of a service line. */
  memo: string | null;
  status: string;
  excludedBy: Exclusion | null;
}

export interface Contract {
  id: string;
  line: number;
  customerId: string;
  start: string;
  /** Null when the exported end is before the start and taken as unknown. */
  end: string | null;
  endAsExported: string;
  annualValue: number | null;
  billingFrequency: string;
  autoRenew: boolean | null;
  tier: string;
  /** Line of an identical contract earlier in the export; a duplicate is counted once. */
  duplicateOf: number | null;
}

export interface Note {
  id: string;
  line: number;
  customerId: string | null;
  nameAsWritten: string;
  linkedBy: NameLink['method'];
  /** For a note linked to no customer because its name fits several: those customers. */
  candidates: string[];
  date: string;
  author: string;
  text: string;
}

/** A name or id a customer appears under in one of the files, and how it was linked. */
export interface Alias {
  source: 'crm' | Source | 'notes';
  value: string;
  linkedBy: 'crm' | 'merged' | 'not-in-crm' | NonNullable<NameLink['method']>;
}

export interface CustomerRecord extends Customer {
  aliases: Alias[];
  /** The contract that started last. */
  contractId: string | null;
}

export interface Tally {
  rows: number;
  amount: number;
}

/** How one export's total becomes the counted total, rule by rule. */
export interface Reconciliation {
  source: Source;
  exported: Tally;
  /** The total the export states about itself, if it has one. */
  statedTotal: number | null;
  excluded: Record<Exclusion, Tally>;
  counted: Tally;
  /** Counted invoices that no customer could be found for. */
  unassigned: Tally;
}

export interface Model {
  customers: CustomerRecord[];
  invoices: Invoice[];
  contracts: Contract[];
  notes: Note[];
  reconciliation: Reconciliation[];
  duplicateGroups: DuplicateGroup[];
  shortenedNames: ShortenedName[];
  unmapped: UnmappedValue[];
  configProblems: string[];
}

export function assembleModel(parsed: ParsedExports, resolution: Resolution, assumptions: Assumptions): Model {
  const quickbooksInvoices = parsed.quickbooks.map((row) => invoiceFromQuickBooks(row, resolution, assumptions));
  const netsuiteInvoices = parsed.netsuite.map((row) => invoiceFromNetSuite(row, resolution, assumptions));
  const invoices = [...quickbooksInvoices, ...netsuiteInvoices];
  const contracts = parsed.contracts.map((row) => contractFrom(row, resolution, assumptions));
  const notes = notesFrom(parsed, resolution);
  const customers = customerRecords(resolution, contracts);
  const reconciliation = reconcile(invoices, parsed);

  return {
    customers,
    invoices,
    contracts,
    notes,
    reconciliation,
    duplicateGroups: resolution.duplicateGroups,
    shortenedNames: resolution.shortenedNames,
    unmapped: parsed.unmapped,
    configProblems: resolution.configProblems,
  };
}

function invoiceFromQuickBooks(row: QuickBooksInvoice, resolution: Resolution, assumptions: Assumptions): Invoice {
  const key = `quickbooks:${row.invoiceNo}`;
  const link = resolution.quickbooksNames[row.customerName];
  return {
    key,
    source: 'quickbooks',
    line: row.line,
    number: row.invoiceNo,
    customerId: link.customerId,
    customerAsExported: row.customerName,
    date: row.date,
    amount: row.amount,
    serviceLine: row.serviceLine,
    memo: row.memo,
    status: row.status,
    excludedBy: exclusionOf(row, key, assumptions),
  };
}

function invoiceFromNetSuite(row: NetSuiteInvoice, resolution: Resolution, assumptions: Assumptions): Invoice {
  const key = `netsuite:${row.invoiceId}`;
  return {
    key,
    source: 'netsuite',
    line: row.line,
    number: row.invoiceId,
    customerId: resolution.customerOfId[row.customerId] ?? null,
    customerAsExported: row.customerId,
    date: row.date,
    amount: row.amount,
    serviceLine: row.serviceLine,
    memo: null,
    status: row.status,
    excludedBy: exclusionOf(row, key, assumptions),
  };
}

/** The first rule that excludes the invoice, or null if it counts. */
function exclusionOf(
  row: { duplicateOf: number | null; status: string; amount: number },
  key: string,
  assumptions: Assumptions,
): Exclusion | null {
  if (row.duplicateOf !== null && holds(assumptions.duplicateInvoices, key)) return 'duplicate';
  if (row.status === 'void' && holds(assumptions.voidedInvoices, key)) return 'void';
  if (row.amount < 0 && !holds(assumptions.creditMemos, key)) return 'credit';
  return null;
}

function contractFrom(row: ContractRow, resolution: Resolution, assumptions: Assumptions): Contract {
  const endBeforeStart = row.end < row.start;
  const endUnknown = endBeforeStart && holds(assumptions.impossibleContractDates, row.id);
  return {
    id: row.id,
    line: row.line,
    customerId: resolution.customerOfId[row.customerId],
    start: row.start,
    end: endUnknown ? null : row.end,
    endAsExported: row.end,
    annualValue: row.annualValue,
    billingFrequency: row.billingFrequency,
    autoRenew: row.autoRenew,
    tier: row.tier,
    duplicateOf: row.duplicateOf,
  };
}

function notesFrom(parsed: ParsedExports, resolution: Resolution): Note[] {
  return parsed.notes.map((row) => {
    const link = resolution.noteNames[row.customerName];
    return {
      id: row.id,
      line: row.line,
      customerId: link.customerId,
      nameAsWritten: row.customerName,
      linkedBy: link.method,
      candidates: link.candidates,
      date: row.date,
      author: row.author,
      text: row.text,
    };
  });
}

function customerRecords(resolution: Resolution, contracts: Contract[]): CustomerRecord[] {
  const aliases = aliasesByCustomer(resolution);
  const currentContracts = currentContractByCustomer(contracts);
  return resolution.customers.map((customer) => ({
    ...customer,
    aliases: aliases.get(customer.id) ?? [],
    contractId: currentContracts.get(customer.id)?.id ?? null,
  }));
}

/** Every id and name a customer appears under across the files. */
function aliasesByCustomer(resolution: Resolution): Map<string, Alias[]> {
  const out = new Map<string, Alias[]>();
  const add = (customerId: string, alias: Alias) => {
    const list = out.get(customerId) ?? [];
    list.push(alias);
    out.set(customerId, list);
  };
  for (const customer of resolution.customers) {
    for (const id of customer.crmIds) {
      const linkedBy = id === customer.id ? 'crm' : 'merged';
      add(customer.id, { source: 'crm', value: id, linkedBy });
    }
    for (const id of customer.otherIds) add(customer.id, { source: 'netsuite', value: id, linkedBy: 'not-in-crm' });
  }
  const names: [Alias['source'], Record<string, NameLink>][] = [
    ['quickbooks', resolution.quickbooksNames],
    ['notes', resolution.noteNames],
  ];
  for (const [source, links] of names) {
    for (const [value, link] of Object.entries(links)) {
      if (link.customerId && link.method) add(link.customerId, { source, value, linkedBy: link.method });
    }
  }
  return out;
}

/** Looks up a customer's current contract: null when it has none on file. */
export function currentContractOf(model: Pick<Model, 'contracts'>): (customer: CustomerRecord) => Contract | null {
  const contracts = new Map(model.contracts.map((c) => [c.id, c]));
  return (customer) => (customer.contractId ? (contracts.get(customer.contractId) ?? null) : null);
}

/**
 * The current contract of each customer: the one that started last, since a renewal starts after the
 * contract it renews. Duplicates are skipped.
 */
function currentContractByCustomer(contracts: Contract[]): Map<string, Contract> {
  const out = new Map<string, Contract>();
  for (const contract of contracts) {
    if (contract.duplicateOf !== null) continue;
    const current = out.get(contract.customerId);
    if (!current || contract.start > current.start) out.set(contract.customerId, contract);
  }
  return out;
}

function reconcile(invoices: Invoice[], parsed: ParsedExports): Reconciliation[] {
  const sources: Source[] = ['quickbooks', 'netsuite'];
  return sources.map((source) => {
    const rows = invoices.filter((i) => i.source === source);
    const statedTotal = parsed.nonDataLines.find((l) => l.export === source && l.kind === 'total');
    return {
      source,
      exported: tally(rows, () => true),
      statedTotal: statedTotal?.amount ?? null,
      excluded: {
        duplicate: tally(rows, (i) => i.excludedBy === 'duplicate'),
        void: tally(rows, (i) => i.excludedBy === 'void'),
        credit: tally(rows, (i) => i.excludedBy === 'credit'),
      },
      counted: tally(rows, (i) => i.excludedBy === null),
      unassigned: tally(rows, (i) => i.excludedBy === null && i.customerId === null),
    };
  });
}

/** Number of invoices and their total, over those that match. */
function tally(invoices: Invoice[], matches: (invoice: Invoice) => boolean): Tally {
  const matching = invoices.filter(matches);
  const amounts = matching.map((i) => i.amount);
  return { rows: matching.length, amount: sumMoney(amounts) };
}
