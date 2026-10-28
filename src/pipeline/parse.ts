// Turns the raw exports into typed rows, applying mechanical rules only: value formats, spellings
// from the reference data, and lines that are not data. Nothing is decided or dropped here: exact
// duplicate rows are marked, values with no mapping are kept as exported and reported.

import { EXPORTS, type ExportName, type RawExports, type RawRow } from './exports';
import { lookup, type Reference } from './reference';
import { parseDate, parseMoney } from './values';

interface Row {
  line: number;
  /** Line of an earlier row identical in every column, if any. */
  duplicateOf: number | null;
}

export interface CrmRecord extends Row {
  id: string;
  name: string;
  industry: string;
  industryAsExported: string;
  city: string;
  state: string;
  stateAsExported: string;
  accountManager: string | null;
  created: string;
  status: string;
}

export interface QuickBooksInvoice extends Row {
  invoiceNo: string;
  customerName: string;
  date: string;
  amount: number;
  status: string;
  memo: string;
  serviceLine: string | null;
}

export interface NetSuiteInvoice extends Row {
  invoiceId: string;
  customerId: string;
  date: string;
  amount: number;
  currency: string;
  status: string;
  serviceLine: string | null;
}

export interface ContractRow extends Row {
  id: string;
  customerId: string;
  start: string;
  end: string;
  annualValue: number | null;
  billingFrequency: string;
  autoRenew: boolean | null;
  tier: string;
}

export interface NoteRow extends Row {
  id: string;
  customerName: string;
  date: string;
  author: string;
  text: string;
}

/** A line that is not a data row: a total the export states about itself, or a repeated header. */
export interface NonDataLine {
  export: ExportName;
  line: number;
  kind: 'total' | 'repeated-header';
  amount: number | null;
}

export interface UnmappedValue {
  field: 'state' | 'industry' | 'QuickBooks memo' | 'NetSuite service line';
  value: string;
  rows: number;
}

export interface ParsedExports {
  crm: CrmRecord[];
  quickbooks: QuickBooksInvoice[];
  netsuite: NetSuiteInvoice[];
  contracts: ContractRow[];
  notes: NoteRow[];
  nonDataLines: NonDataLine[];
  unmapped: UnmappedValue[];
}

export function parseExports(raw: RawExports, reference: Reference): ParsedExports {
  const unmapped = new Map<string, UnmappedValue>();
  const mapped = (field: UnmappedValue['field'], find: (raw: string) => string | null) => (value: string) => {
    const found = find(value);
    if (found === null) {
      const key = `${field}|${value}`;
      const entry = unmapped.get(key) ?? { field, value, rows: 0 };
      entry.rows++;
      unmapped.set(key, entry);
    }
    return found;
  };
  const state = mapped('state', lookup(reference.states));
  const industry = mapped('industry', lookup(reference.industries));
  const memoLine = mapped('QuickBooks memo', lookup(reference.serviceLines));
  const serviceLine = mapped(
    'NetSuite service line',
    lookup(Object.fromEntries(Object.keys(reference.serviceLines).map((line) => [line, []]))),
  );

  const crm = withDuplicates(
    raw.crm,
    (v, line): Omit<CrmRecord, keyof Row> => ({
      id: v.customer_id.trim(),
      name: v.company_name.trim(),
      industry: industry(v.industry) ?? v.industry.trim(),
      industryAsExported: v.industry,
      city: v.city.trim(),
      state: state(v.state) ?? v.state.trim(),
      stateAsExported: v.state,
      accountManager: v.account_manager.trim() || null,
      created: required('crm', line, 'created_date', parseDate(v.created_date)),
      status: v.status.trim().toLowerCase(),
    }),
  );

  const nonDataLines: NonDataLine[] = [];
  const quickbooksRows = raw.quickbooks.filter(({ line, values: v }) => {
    if (v['Invoice No'] === 'Invoice No' && v.Customer === 'Customer') {
      nonDataLines.push({ export: 'quickbooks', line, kind: 'repeated-header', amount: null });
      return false;
    }
    if (!v['Invoice No'].trim() && v.Customer.trim().toUpperCase() === 'TOTAL') {
      nonDataLines.push({ export: 'quickbooks', line, kind: 'total', amount: parseMoney(v.Amount) });
      return false;
    }
    return true;
  });
  const quickbooks = withDuplicates(
    quickbooksRows,
    (v, line): Omit<QuickBooksInvoice, keyof Row> => ({
      invoiceNo: v['Invoice No'].trim(),
      customerName: v.Customer.trim(),
      date: required('quickbooks', line, 'Invoice Date', parseDate(v['Invoice Date'])),
      amount: required('quickbooks', line, 'Amount', parseMoney(v.Amount)),
      status: v.Status.trim().toLowerCase(),
      memo: v.Memo.trim(),
      serviceLine: memoLine(v.Memo),
    }),
  );

  const netsuite = withDuplicates(
    raw.netsuite,
    (v, line): Omit<NetSuiteInvoice, keyof Row> => ({
      invoiceId: v.invoice_id.trim(),
      customerId: v.customer_ref.trim(),
      date: required('netsuite', line, 'txn_date', parseDate(v.txn_date)),
      amount: required('netsuite', line, 'amount_usd', parseMoney(v.amount_usd)),
      currency: v.currency.trim().toUpperCase(),
      status: v.status.trim().toLowerCase(),
      serviceLine: serviceLine(v.service_line),
    }),
  );

  const contracts = withDuplicates(
    raw.contracts,
    (v, line): Omit<ContractRow, keyof Row> => ({
      id: v.contract_id.trim(),
      customerId: v.customer_id.trim(),
      start: required('contracts', line, 'start_date', parseDate(v.start_date)),
      end: required('contracts', line, 'end_date', parseDate(v.end_date)),
      annualValue: v.annual_value.trim()
        ? required('contracts', line, 'annual_value', parseMoney(v.annual_value))
        : null,
      billingFrequency: v.billing_frequency.trim().toLowerCase(),
      autoRenew: parseYesNo('contracts', line, 'auto_renew', v.auto_renew),
      tier: v.service_tier.trim(),
    }),
  );

  const notes = withDuplicates(
    raw.notes,
    (v, line): Omit<NoteRow, keyof Row> => ({
      id: v.note_id.trim(),
      customerName: v.customer_name.trim(),
      date: required('notes', line, 'note_date', parseDate(v.note_date)),
      author: v.author.trim(),
      text: v.note_text.trim(),
    }),
  );

  return { crm, quickbooks, netsuite, contracts, notes, nonDataLines, unmapped: [...unmapped.values()] };
}

/** Parses each row and marks the ones identical in every column to an earlier row. */
function withDuplicates<T>(rows: RawRow[], parse: (values: Record<string, string>, line: number) => T): (T & Row)[] {
  const firstLine = new Map<string, number>();
  return rows.map(({ line, values }) => {
    const key = Object.values(values).join('\u0001');
    const duplicateOf = firstLine.get(key) ?? null;
    if (duplicateOf === null) firstLine.set(key, line);
    return { line, duplicateOf, ...parse(values, line) };
  });
}

/** A value the pipeline cannot work without: if it does not parse, the export changed and we stop. */
function required<T>(name: ExportName, line: number, column: string, value: T | null): T {
  if (value === null) throw new Error(`${EXPORTS[name].file} line ${line}: cannot read ${column}`);
  return value;
}

function parseYesNo(name: ExportName, line: number, column: string, raw: string): boolean | null {
  const s = raw.trim().toLowerCase();
  if (s === '') return null;
  if (s === 'yes' || s === 'no') return s === 'yes';
  throw new Error(`${EXPORTS[name].file} line ${line}: cannot read ${column} "${raw}"`);
}
