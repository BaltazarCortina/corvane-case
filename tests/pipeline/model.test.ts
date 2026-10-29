import { describe, expect, it } from 'vitest';
import type { Assumptions } from '../../src/pipeline/assumptions';
import { build } from '../../src/pipeline/build';
import type { RawExports } from '../../src/pipeline/exports';
import type { Reference } from '../../src/pipeline/reference';
import { assumptionsWith, exportsWith } from '../fixtures';

const reference: Reference = {
  fiscalYearStartMonth: 4,
  states: {},
  industries: {},
  serviceLines: { Repair: ['Valve repair'], 'Credit memos': ['Credit memo'] },
};

const raw: RawExports = exportsWith({
  crm: ['C-1,Acme Retail,Retail,Toledo,OH,L. Brennan,2020-01-01,Active'],
  quickbooks: [
    'INV-1,Acme Retail,04/01/2024,$100.00,Paid,Valve repair',
    'INV-2,Acme Retail,04/02/2024,($10.00),Paid,Credit memo',
    'INV-3,Nobody Inc,04/03/2024,$5.00,Paid,Valve repair',
  ],
  netsuite: [
    'NS-1,C-1,2025-04-01,200.00,USD,paid,Repair',
    'NS-1,C-1,2025-04-01,200.00,USD,paid,Repair',
    'NS-2,C-1,2025-04-02,50.00,USD,void,Repair',
    'NS-2,C-1,2025-04-02,50.00,USD,void,Repair',
  ],
  contracts: [
    'CTR-1,C-1,2023-01-01,2023-12-31,1000.0,Monthly,Yes,Gold',
    'CTR-2,C-1,2025-05-01,2024-04-30,1200.0,Monthly,Yes,Gold',
    'CTR-2,C-1,2025-05-01,2024-04-30,1200.0,Monthly,Yes,Gold',
  ],
  notes: ['N-1,Acme Retail,2025-01-01,L. Brennan,All good.', 'N-2,Prospect Co,2025-01-02,L. Brennan,Toured sites.'],
});

const modelWith = (assumptions: Assumptions = assumptionsWith()) => build({ raw, reference, assumptions });

describe('invoices', () => {
  it('keeps every row and marks the first rule that excludes it', () => {
    const model = modelWith();
    const marks = model.invoices.map((i) => [i.key, i.excludedBy]);
    expect(marks).toEqual([
      ['quickbooks:INV-1', null],
      ['quickbooks:INV-2', null],
      ['quickbooks:INV-3', null],
      ['netsuite:NS-1', null],
      ['netsuite:NS-1', 'duplicate'],
      ['netsuite:NS-2', 'void'],
      ['netsuite:NS-2', 'duplicate'],
    ]);
  });

  it('links each invoice to its customer, or to none', () => {
    const model = modelWith();
    const customers = model.invoices.map((i) => i.customerId);
    expect(customers).toEqual(['C-1', 'C-1', null, 'C-1', 'C-1', 'C-1', 'C-1']);
  });

  it('counts the copies of an invoice excepted from the duplicate rule', () => {
    const assumptions = assumptionsWith({ duplicateInvoices: { exceptions: ['netsuite:NS-1'] } });
    const model = modelWith(assumptions);
    const copies = model.invoices.filter((i) => i.key === 'netsuite:NS-1');
    expect(copies.map((i) => i.excludedBy)).toEqual([null, null]);
  });

  it('counts voided invoices when the rule is off', () => {
    const assumptions = assumptionsWith({ voidedInvoices: { applies: false } });
    const model = modelWith(assumptions);
    const voided = model.invoices.find((i) => i.status === 'void');
    expect(voided?.excludedBy).toBeNull();
  });

  it('excludes credit memos only when the rule is off', () => {
    const assumptions = assumptionsWith({ creditMemos: { applies: false } });
    const credit = modelWith(assumptions).invoices.find((i) => i.amount < 0);
    expect(credit?.excludedBy).toBe('credit');
  });
});

describe('parameters', () => {
  it('reports an excluded line that is not a service line', () => {
    const known = assumptionsWith({ parameters: { atypicalInvoiceExcludedLines: ['Repair'] } });
    const typo = assumptionsWith({ parameters: { atypicalInvoiceExcludedLines: ['Repairs'] } });
    expect(modelWith(known).configProblems).toEqual([]);
    expect(modelWith(typo).configProblems).toEqual(['atypical invoice excluded line Repairs is not a service line']);
  });
});

describe('reconciliation', () => {
  it('goes from the exported total to the counted one, rule by rule', () => {
    const [quickbooks, netsuite] = modelWith().reconciliation;
    expect(quickbooks).toMatchObject({
      exported: { rows: 3, amount: 95 },
      counted: { rows: 3, amount: 95 },
      unassigned: { rows: 1, amount: 5 },
    });
    expect(netsuite).toMatchObject({
      exported: { rows: 4, amount: 500 },
      excluded: { duplicate: { rows: 2, amount: 250 }, void: { rows: 1, amount: 50 }, credit: { rows: 0, amount: 0 } },
      counted: { rows: 1, amount: 200 },
    });
  });
});

describe('contracts', () => {
  it('takes an end before the start as unknown', () => {
    const contract = modelWith().contracts.find((c) => c.id === 'CTR-2');
    expect(contract).toMatchObject({ end: null, endAsExported: '2024-04-30' });
  });

  it('keeps the end as exported when the rule is off', () => {
    const assumptions = assumptionsWith({ impossibleContractDates: { applies: false } });
    const contract = modelWith(assumptions).contracts.find((c) => c.id === 'CTR-2');
    expect(contract?.end).toBe('2024-04-30');
  });

  it('makes the contract that started last the current one, skipping duplicates', () => {
    const model = modelWith();
    expect(model.customers[0].contractId).toBe('CTR-2');
    expect(model.contracts.map((c) => c.duplicateOf)).toEqual([null, null, 3]);
  });
});

describe('customers and notes', () => {
  it('lists every name and id a customer appears under', () => {
    const [customer] = modelWith().customers;
    expect(customer.aliases).toEqual([
      { source: 'crm', value: 'C-1', linkedBy: 'crm' },
      { source: 'quickbooks', value: 'Acme Retail', linkedBy: 'exact' },
      { source: 'notes', value: 'Acme Retail', linkedBy: 'exact' },
    ]);
  });

  it('keeps notes linked to no customer', () => {
    const notes = modelWith().notes.map((n) => [n.id, n.customerId]);
    expect(notes).toEqual([
      ['N-1', 'C-1'],
      ['N-2', null],
    ]);
  });
});
