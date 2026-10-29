import { describe, expect, it } from 'vitest';
import type { Assignment } from '../../src/pipeline/assumptions';
import type { CrmRecord, ParsedExports } from '../../src/pipeline/parse';
import { resolveCustomers } from '../../src/pipeline/resolve';
import { assumptionsWith } from '../fixtures';

function crm(id: string, name: string, more: Partial<CrmRecord> = {}): CrmRecord {
  return {
    line: 0,
    duplicateOf: null,
    id,
    name,
    industry: 'Retail',
    industryAsExported: 'Retail',
    city: 'Toledo',
    state: 'OH',
    stateAsExported: 'OH',
    accountManager: 'L. Brennan',
    created: '2020-01-01',
    status: 'active',
    ...more,
  };
}

interface Fixture {
  crm?: CrmRecord[];
  quickbooksNames?: string[];
  netsuiteIds?: string[];
  noteNames?: string[];
}

function parsed(f: Fixture): ParsedExports {
  const row = { line: 0, duplicateOf: null, date: '2025-01-01', amount: 1, status: 'paid', serviceLine: 'Repair' };
  return {
    crm: f.crm ?? [],
    quickbooks: (f.quickbooksNames ?? []).map((customerName) => ({ ...row, invoiceNo: 'I', customerName, memo: '' })),
    netsuite: (f.netsuiteIds ?? []).map((customerId) => ({ ...row, invoiceId: 'N', customerId, currency: 'USD' })),
    contracts: [],
    notes: (f.noteNames ?? []).map((customerName) => ({
      line: 0,
      duplicateOf: null,
      id: 'N-1',
      customerName,
      date: '2025-01-01',
      author: 'A',
      text: '',
    })),
    nonDataLines: [],
    unmapped: [],
  };
}

const assignment = (source: Assignment['source'], value: string, customer: string): Assignment => ({
  source,
  value,
  customer,
  confirmed: false,
  evidence: '',
});

describe('duplicate CRM records', () => {
  const records = [
    crm('C-2', 'GRANVILLE INNS', { created: '2023-05-08', accountManager: 'M. Okoro' }),
    crm('C-1', 'Granville Inns', { created: '2024-12-11' }),
    crm('C-3', 'Granville Inns Inc', { city: 'Dayton' }),
  ];

  it('merges records with the same name and location, keeping the oldest as the main record', () => {
    const r = resolveCustomers(parsed({ crm: records.slice(0, 2) }), assumptionsWith());
    expect(r.customers).toHaveLength(1);
    expect(r.customers[0]).toMatchObject({
      id: 'C-2',
      name: 'Granville Inns',
      crmIds: ['C-1', 'C-2'],
      created: '2023-05-08',
      accountManagers: ['L. Brennan', 'M. Okoro'],
    });
    expect(r.customerOfId).toEqual({ 'C-1': 'C-2', 'C-2': 'C-2' });
  });

  it('keeps records in different locations apart, as possible duplicates', () => {
    const r = resolveCustomers(parsed({ crm: records }), assumptionsWith());
    expect(r.customers).toHaveLength(3);
    expect(r.duplicateGroups).toEqual([
      { key: 'C-1+C-2+C-3', crmIds: ['C-1', 'C-2', 'C-3'], sameLocation: false, merged: false },
    ]);
  });

  it('keeps an exception apart', () => {
    const r = resolveCustomers(
      parsed({ crm: records.slice(0, 2) }),
      assumptionsWith({ duplicateCustomers: { exceptions: ['C-1+C-2'] } }),
    );
    expect(r.customers).toHaveLength(2);
    expect(r.duplicateGroups[0].merged).toBe(false);
  });

  it('merges a possible duplicate in another location only by exception', () => {
    const r = resolveCustomers(
      parsed({ crm: records }),
      assumptionsWith({ duplicateCustomers: { exceptions: ['C-1+C-2+C-3'] } }),
    );
    expect(r.customers).toHaveLength(1);
  });

  it('keeps every record apart when the rule is off', () => {
    const r = resolveCustomers(
      parsed({ crm: records.slice(0, 2) }),
      assumptionsWith({ duplicateCustomers: { applies: false } }),
    );
    expect(r.customers).toHaveLength(2);
  });

  it('prefers a name without a legal suffix', () => {
    const r = resolveCustomers(
      parsed({
        crm: [crm('C-1', 'Carrow Market Group, Inc.'), crm('C-2', 'Carrow Market Group', { created: '2024-01-01' })],
      }),
      assumptionsWith(),
    );
    expect(r.customers[0]).toMatchObject({ id: 'C-1', name: 'Carrow Market Group' });
  });
});

describe('names', () => {
  const records = [
    crm('C-1', 'Halloran Academy'),
    crm('C-2', 'Halloran Health Partners'),
    crm('C-3', 'Kessler Surgical Center'),
    crm('C-4', 'Evanston Row Stores'),
    crm('C-5', 'Evanston Row Fabrication'),
  ];

  it('links exact and normalized names, never a similar one', () => {
    const r = resolveCustomers(
      parsed({
        crm: records,
        quickbooksNames: ['Halloran Academy', 'HALLORAN HEALTH PARTNERS, Inc.', 'Halloran Hotels'],
      }),
      assumptionsWith(),
    );
    expect(r.quickbooksNames).toEqual({
      'Halloran Academy': { customerId: 'C-1', method: 'exact', candidates: [] },
      'HALLORAN HEALTH PARTNERS, Inc.': { customerId: 'C-2', method: 'normalized', candidates: [] },
      'Halloran Hotels': { customerId: null, method: null, candidates: [] },
    });
  });

  it('accepts a shortened note name only when it starts exactly one customer name', () => {
    const r = resolveCustomers(
      parsed({ crm: records, noteNames: ['Kessler Surgical', 'Evanston Row', 'Halloran'] }),
      assumptionsWith(),
    );
    expect(r.noteNames).toEqual({
      'Kessler Surgical': { customerId: 'C-3', method: 'shortened', candidates: [] },
      'Evanston Row': { customerId: null, method: null, candidates: ['C-4', 'C-5'] },
      Halloran: { customerId: null, method: null, candidates: [] },
    });
    expect(r.shortenedNames).toEqual([{ name: 'Kessler Surgical', customerId: 'C-3', accepted: true }]);
  });

  it('lists the candidates of a full name shared by customers kept apart', () => {
    const twins = [crm('C-1', 'Granville Inns'), crm('C-2', 'GRANVILLE INNS')];
    const keptApart = assumptionsWith({ duplicateCustomers: { exceptions: ['C-1+C-2'] } });
    const r = resolveCustomers(parsed({ crm: twins, noteNames: ['granville inns'] }), keptApart);
    expect(r.noteNames['granville inns']).toEqual({ customerId: null, method: null, candidates: ['C-1', 'C-2'] });
  });

  it('does not shorten QuickBooks names', () => {
    const r = resolveCustomers(parsed({ crm: records, quickbooksNames: ['Kessler Surgical'] }), assumptionsWith());
    expect(r.quickbooksNames['Kessler Surgical'].customerId).toBeNull();
  });

  it('rejects a shortened name by exception', () => {
    const r = resolveCustomers(
      parsed({ crm: records, noteNames: ['Kessler Surgical'] }),
      assumptionsWith({ shortenedNoteNames: { exceptions: ['Kessler Surgical'] } }),
    );
    expect(r.noteNames['Kessler Surgical'].customerId).toBeNull();
    expect(r.shortenedNames[0].accepted).toBe(false);
  });
});

describe('ids missing from the CRM and assignments', () => {
  it('makes an unknown id a customer of its own, named by the QuickBooks name assigned to it', () => {
    const r = resolveCustomers(
      parsed({
        crm: [crm('C-1', 'Acme')],
        netsuiteIds: ['C-1', 'C-9'],
        quickbooksNames: ['Larkin Hotels'],
        noteNames: ['larkin hotels'],
      }),
      assumptionsWith({ assignments: [assignment('quickbooks', 'Larkin Hotels', 'C-9')] }),
    );
    expect(r.customers.find((c) => c.id === 'C-9')).toMatchObject({
      name: 'Larkin Hotels',
      inCrm: false,
      otherIds: ['C-9'],
    });
    expect(r.quickbooksNames['Larkin Hotels']).toEqual({ customerId: 'C-9', method: 'assigned', candidates: [] });
    expect(r.noteNames['larkin hotels']).toEqual({ customerId: 'C-9', method: 'normalized', candidates: [] });
  });

  it('links an unknown id to a CRM customer when assigned', () => {
    const r = resolveCustomers(
      parsed({ crm: [crm('C-1', 'Acme')], netsuiteIds: ['C-9'] }),
      assumptionsWith({ assignments: [assignment('netsuite', 'C-9', 'C-1')] }),
    );
    expect(r.customers).toHaveLength(1);
    expect(r.customers[0].otherIds).toEqual(['C-9']);
    expect(r.customerOfId['C-9']).toBe('C-1');
  });

  it('puts an assignment before the name rules', () => {
    const r = resolveCustomers(
      parsed({ crm: [crm('C-1', 'Acme'), crm('C-2', 'Acme Two')], quickbooksNames: ['Acme'] }),
      assumptionsWith({ assignments: [assignment('quickbooks', 'Acme', 'C-2')] }),
    );
    expect(r.quickbooksNames.Acme).toEqual({ customerId: 'C-2', method: 'assigned', candidates: [] });
  });

  it('reports config entries that point to nothing', () => {
    const r = resolveCustomers(
      parsed({ crm: [crm('C-1', 'Acme')], quickbooksNames: ['Acme'] }),
      assumptionsWith({
        assignments: [assignment('quickbooks', 'Acme', 'C-404'), assignment('quickbooks', 'Gone Inc', 'C-1')],
        duplicateCustomers: { exceptions: ['C-7+C-8'] },
      }),
    );
    expect(r.quickbooksNames.Acme).toEqual({ customerId: 'C-1', method: 'exact', candidates: [] });
    expect(r.configProblems).toEqual([
      'quickbooks:Acme is assigned to C-404, which is not a known customer',
      'quickbooks:Gone Inc is assigned but not in the data',
      'duplicate customers C-7+C-8 is not in the data',
    ]);
  });
});
