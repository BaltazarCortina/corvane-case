import { describe, expect, it } from 'vitest';
import { parseExports } from '../../src/pipeline/parse';
import type { Reference } from '../../src/pipeline/reference';
import { exportsWith } from '../fixtures';

const reference: Reference = {
  fiscalYearStartMonth: 4,
  states: { OH: ['Ohio'] },
  industries: { Retail: [] },
  serviceLines: { Repair: ['Valve repair'], Monitoring: ['Monitoring - monthly'] },
};

describe('QuickBooks', () => {
  const parsed = parseExports(
    exportsWith({
      quickbooks: [
        'INV-1,Acme Retail,04/01/2024,"$1,200.50",Paid,Valve repair',
        'INV-2,Acme Retail,"Apr 02, 2024",($300.00),Open,Monitoring - monthly',
        'Invoice No,Customer,Invoice Date,Amount,Status,Memo',
        'INV-3,Acme Retail,04/03/2024,$50.00,Paid,Something new',
        ',TOTAL,,"$950.50",,',
      ],
    }),
    reference,
  );

  it('sets aside the repeated header and the total row, keeping the stated total', () => {
    expect(parsed.nonDataLines).toEqual([
      { export: 'quickbooks', line: 4, kind: 'repeated-header', amount: null },
      { export: 'quickbooks', line: 6, kind: 'total', amount: 950.5 },
    ]);
    expect(parsed.quickbooks.map((i) => i.invoiceNo)).toEqual(['INV-1', 'INV-2', 'INV-3']);
  });

  it('reads both date formats and accounting negatives', () => {
    expect(parsed.quickbooks.map((i) => [i.date, i.amount])).toEqual([
      ['2024-04-01', 1200.5],
      ['2024-04-02', -300],
      ['2024-04-03', 50],
    ]);
  });

  it('maps memos to service lines and reports the ones it does not know', () => {
    expect(parsed.quickbooks.map((i) => i.serviceLine)).toEqual(['Repair', 'Monitoring', null]);
    expect(parsed.unmapped).toEqual([{ field: 'QuickBooks memo', value: 'Something new', rows: 1 }]);
  });

  it('fails on a value it cannot read, naming the file and line', () => {
    const broken = exportsWith({ quickbooks: ['INV-1,Acme,2024/04/01,$10.00,Paid,Valve repair'] });
    expect(() => parseExports(broken, reference)).toThrow(
      'invoices_2024_2025_quickbooks.csv line 2: cannot read Invoice Date',
    );
  });
});

describe('NetSuite', () => {
  const parsed = parseExports(
    exportsWith({
      netsuite: [
        'NS-1,C-0001,2025-04-01,100.00,USD,paid,Repair',
        'NS-2,C-0001,2025-04-02,-20.00,USD,void,monitoring',
        'NS-1,C-0001,2025-04-01,100.00,USD,paid,Repair',
        'NS-3,C-0002,2025-04-03,10.00,usd,open,Valve repair',
      ],
    }),
    reference,
  );

  it('marks rows identical to an earlier one, without removing them', () => {
    expect(parsed.netsuite.map((i) => [i.invoiceId, i.duplicateOf])).toEqual([
      ['NS-1', null],
      ['NS-2', null],
      ['NS-1', 2],
      ['NS-3', null],
    ]);
  });

  it('accepts only canonical service lines, ignoring case', () => {
    expect(parsed.netsuite.map((i) => i.serviceLine)).toEqual(['Repair', 'Monitoring', 'Repair', null]);
    expect(parsed.unmapped).toEqual([{ field: 'NetSuite service line', value: 'Valve repair', rows: 1 }]);
  });

  it('unifies the case of status and currency', () => {
    expect(parsed.netsuite.map((i) => [i.status, i.currency])).toEqual([
      ['paid', 'USD'],
      ['void', 'USD'],
      ['paid', 'USD'],
      ['open', 'USD'],
    ]);
  });
});

describe('CRM', () => {
  const parsed = parseExports(
    exportsWith({
      crm: [
        'C-0001,Acme Retail,retail,Toledo,Ohio,L. Brennan,04/08/2022,Active',
        'C-0002,Acme Stores,Grocery,Columbus,Oh.,,2023-01-15,inactive',
      ],
    }),
    reference,
  );

  it('maps spellings to canonical values and keeps unknown ones as exported', () => {
    expect(parsed.crm.map((c) => [c.state, c.industry])).toEqual([
      ['OH', 'Retail'],
      ['Oh.', 'Grocery'],
    ]);
    expect(parsed.unmapped).toEqual([
      { field: 'industry', value: 'Grocery', rows: 1 },
      { field: 'state', value: 'Oh.', rows: 1 },
    ]);
  });

  it('reads both date formats, a missing account manager and the status in one case', () => {
    expect(parsed.crm.map((c) => [c.created, c.accountManager, c.status])).toEqual([
      ['2022-04-08', 'L. Brennan', 'active'],
      ['2023-01-15', null, 'inactive'],
    ]);
  });
});

describe('contracts', () => {
  const parsed = parseExports(
    exportsWith({
      contracts: [
        'CTR-1,C-0001,2024-02-01,2027-01-31,94800.0,Monthly,Yes,Bronze',
        'CTR-2,C-0002,2025-05-01,2024-04-28,,monthly,yes,Silver',
        'CTR-3,C-0003,2024-10-01,2027-09-30,89100.0,Quarterly,,Gold',
      ],
    }),
    reference,
  );

  it('unifies text variants and keeps missing values as unknown', () => {
    expect(parsed.contracts.map((c) => [c.billingFrequency, c.autoRenew, c.annualValue])).toEqual([
      ['monthly', true, 94800],
      ['monthly', true, null],
      ['quarterly', null, 89100],
    ]);
  });

  it('keeps dates as exported, even when the end is before the start', () => {
    expect(parsed.contracts[1]).toMatchObject({ start: '2025-05-01', end: '2024-04-28' });
  });

  it('fails on an auto-renew value it does not know', () => {
    const broken = exportsWith({ contracts: ['CTR-1,C-0001,2024-02-01,2027-01-31,1.0,Monthly,Maybe,Gold'] });
    expect(() => parseExports(broken, reference)).toThrow('contracts.csv line 2: cannot read auto_renew "Maybe"');
  });
});

describe('notes', () => {
  it('keeps the customer name as written and trims the text', () => {
    const parsed = parseExports(
      exportsWith({ notes: ['N-1,kessler surgical,2024-10-02,D. Hargrove,"  Site visit, all fine. "'] }),
      reference,
    );
    expect(parsed.notes[0]).toMatchObject({ customerName: 'kessler surgical', text: 'Site visit, all fine.' });
  });
});
