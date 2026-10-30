// Reads the five CSV exports as they came from Corvane: every value still a string, every row with
// its line number in the file so any problem can be traced back to the source.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'csv-parse/sync';

export const EXPORTS = {
  crm: {
    file: 'crm_customers.csv',
    columns: ['customer_id', 'company_name', 'industry', 'city', 'state', 'account_manager', 'created_date', 'status'],
  },
  quickbooks: {
    file: 'invoices_2024_2025_quickbooks.csv',
    columns: ['Invoice No', 'Customer', 'Invoice Date', 'Amount', 'Status', 'Memo'],
  },
  netsuite: {
    file: 'invoices_2025_2026_netsuite.csv',
    columns: ['invoice_id', 'customer_ref', 'txn_date', 'amount_usd', 'currency', 'status', 'service_line'],
  },
  contracts: {
    file: 'contracts.csv',
    columns: [
      'contract_id',
      'customer_id',
      'start_date',
      'end_date',
      'annual_value',
      'billing_frequency',
      'auto_renew',
      'service_tier',
    ],
  },
  notes: {
    file: 'account_notes.csv',
    columns: ['note_id', 'customer_name', 'note_date', 'author', 'note_text'],
  },
} as const;

export type ExportName = keyof typeof EXPORTS;

export interface RawRow {
  /** Line in the file, the header being line 1. */
  line: number;
  values: Record<string, string>;
}

export type RawExports = Record<ExportName, RawRow[]>;

/** Parses one CSV export. Fails if a column the pipeline reads is missing. */
export function parseCsv(name: ExportName, text: string): RawRow[] {
  const records: { record: Record<string, string>; info: { lines: number } }[] = parse(text, {
    columns: (header: string[]) => {
      const missing = EXPORTS[name].columns.filter((c) => !header.includes(c));
      if (missing.length) throw new Error(`${EXPORTS[name].file}: missing columns ${missing.join(', ')}`);
      return header;
    },
    skip_empty_lines: true,
    bom: true,
    info: true,
  });
  return records.map(({ record, info }) => ({ line: info.lines, values: record }));
}

export function loadExports(dir: string): RawExports {
  const read = (name: ExportName) => parseCsv(name, readFileSync(join(dir, EXPORTS[name].file), 'utf8'));
  return {
    crm: read('crm'),
    quickbooks: read('quickbooks'),
    netsuite: read('netsuite'),
    contracts: read('contracts'),
    notes: read('notes'),
  };
}
