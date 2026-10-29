// Builders for small inputs shared across tests.

import type { Assignment, Assumptions, Rule } from '../src/pipeline/assumptions';
import { EXPORTS, type ExportName, parseCsv, type RawExports } from '../src/pipeline/exports';

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

type RuleName = Exclude<keyof Assumptions, 'assignments'>;

/** Every rule applied, unconfirmed and without exceptions, unless overridden. */
export function assumptionsWith(
  overrides: Partial<Record<RuleName, Partial<Rule>>> & { assignments?: Assignment[] } = {},
): Assumptions {
  const rule = (name: RuleName): Rule => ({
    applies: true,
    confirmed: false,
    basis: '',
    exceptions: [],
    ...overrides[name],
  });
  return {
    duplicateCustomers: rule('duplicateCustomers'),
    shortenedNoteNames: rule('shortenedNoteNames'),
    duplicateInvoices: rule('duplicateInvoices'),
    voidedInvoices: rule('voidedInvoices'),
    creditMemos: rule('creditMemos'),
    impossibleContractDates: rule('impossibleContractDates'),
    assignments: overrides.assignments ?? [],
  };
}
