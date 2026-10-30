import { describe, expect, it } from 'vitest';
import { analyze } from '../../src/analysis/analyze';
import { buildWorklist, type GroupInputs, groupOf, type Renewal } from '../../src/analysis/worklist';
import type { NoteSignal } from '../../src/llm/notes';
import type { Inputs } from '../../src/pipeline/build';
import type { Reference } from '../../src/pipeline/reference';
import { assumptionsWith, exportsWith } from '../fixtures';

const { parameters } = assumptionsWith();
const asOf = '2026-09-30';

const endingIn = (daysToEnd: number | null): Renewal => ({
  contractId: 'CTR-1',
  end: null,
  daysToEnd,
  expired: daysToEnd !== null && daysToEnd < 0,
  autoRenew: true,
});

const billing = (risk: GroupInputs['risk'], renewal: Renewal | null = null): GroupInputs => ({
  status: 'billing',
  lastInvoice: '2026-09-15',
  risk,
  renewal,
});

describe('groupOf', () => {
  it('puts a customer that stopped billing in the last twelve months in Win back, before any risk rule', () => {
    const stopped: GroupInputs = { status: 'stopped', lastInvoice: '2026-03-01', risk: 'high', renewal: endingIn(30) };
    expect(groupOf(stopped, asOf, parameters)).toBe('winBack');
  });

  it('leaves out a customer that stopped longer ago, or never billed', () => {
    const longAgo: GroupInputs = { status: 'stopped', lastInvoice: '2025-06-01', risk: 'high', renewal: null };
    const never: GroupInputs = { status: 'neverBilled', lastInvoice: null, risk: 'none', renewal: null };
    expect(groupOf(longAgo, asOf, parameters)).toBeNull();
    expect(groupOf(never, asOf, parameters)).toBeNull();
  });

  it('acts now on high risk, whatever the contract', () => {
    expect(groupOf(billing('high'), asOf, parameters)).toBe('actNow');
    expect(groupOf(billing('high', endingIn(500)), asOf, parameters)).toBe('actNow');
  });

  it('acts now on medium risk only when the contract ends soon or has ended; otherwise monitors it', () => {
    expect(groupOf(billing('medium', endingIn(90)), asOf, parameters)).toBe('actNow');
    expect(groupOf(billing('medium', endingIn(-30)), asOf, parameters)).toBe('actNow');
    expect(groupOf(billing('medium', endingIn(91)), asOf, parameters)).toBe('monitor');
    expect(groupOf(billing('medium', endingIn(null)), asOf, parameters)).toBe('monitor');
    expect(groupOf(billing('medium'), asOf, parameters)).toBe('monitor');
  });

  it('lists low or no risk as a renewal when the contract ends within the horizon or has ended', () => {
    expect(groupOf(billing('low', endingIn(180)), asOf, parameters)).toBe('renewals');
    expect(groupOf(billing('none', endingIn(-200)), asOf, parameters)).toBe('renewals');
  });

  it('monitors the rest at low risk and leaves out the rest at none', () => {
    expect(groupOf(billing('low', endingIn(181)), asOf, parameters)).toBe('monitor');
    expect(groupOf(billing('low'), asOf, parameters)).toBe('monitor');
    expect(groupOf(billing('none', endingIn(181)), asOf, parameters)).toBeNull();
    expect(groupOf(billing('none'), asOf, parameters)).toBeNull();
  });
});

const reference: Reference = {
  fiscalYearStartMonth: 4,
  states: {},
  industries: {},
  serviceLines: { Repair: [], 'Inspection & Testing': [] },
};

// As of 2026-09-30, comparing H1 FY27 with H1 FY26. Acme stopped after a high note; Bolt stopped over
// a year ago; Crane renews soon by itself; Delta has a medium note; Echo never billed; Fox stopped
// with its contract in force; Gale's typical billing fell 70% behind a large project; Hale has a
// medium note and an ended contract.
const raw = exportsWith({
  crm: [
    'C-1,Acme Retail,Retail,Toledo,OH,L. Brennan,2020-01-01,Active',
    'C-2,Bolt Logistics,Logistics,Toledo,OH,L. Brennan,2020-01-01,Active',
    'C-3,Crane Inns,Hospitality,Toledo,OH,L. Brennan,2020-01-01,Active',
    'C-4,Delta Stores,Retail,Toledo,OH,L. Brennan,2020-01-01,Active',
    'C-5,Echo Clinic,Healthcare,Toledo,OH,L. Brennan,2020-01-01,Active',
    'C-6,Fox Academy,Education,Toledo,OH,L. Brennan,2020-01-01,Active',
    'C-7,Gale Industries,Manufacturing,Toledo,OH,L. Brennan,2020-01-01,Active',
    'C-8,Hale Hotels,Hospitality,Toledo,OH,L. Brennan,2020-01-01,Active',
  ],
  netsuite: [
    'NS-1,C-1,2025-05-01,40000.00,USD,paid,Repair',
    'NS-2,C-1,2025-09-01,40000.00,USD,paid,Repair',
    'NS-3,C-1,2026-03-01,40000.00,USD,paid,Repair',
    'NS-4,C-2,2025-06-01,5000.00,USD,paid,Repair',
    'NS-5,C-3,2025-06-01,10000.00,USD,paid,Repair',
    'NS-6,C-3,2026-06-01,10000.00,USD,paid,Repair',
    'NS-7,C-3,2026-09-30,1000.00,USD,paid,Repair',
    'NS-8,C-4,2025-06-01,10000.00,USD,paid,Repair',
    'NS-9,C-4,2026-08-01,10000.00,USD,paid,Repair',
    'NS-10,C-6,2025-06-01,10000.00,USD,paid,Repair',
    'NS-11,C-6,2026-05-01,10000.00,USD,paid,Repair',
    'NS-12,C-7,2025-05-01,100000.00,USD,paid,Inspection & Testing',
    'NS-13,C-7,2026-08-01,30000.00,USD,paid,Inspection & Testing',
    'NS-14,C-7,2026-09-01,300000.00,USD,paid,Repair',
    'NS-15,C-8,2025-06-01,5000.00,USD,paid,Repair',
    'NS-16,C-8,2026-08-01,5000.00,USD,paid,Repair',
  ],
  contracts: [
    'CTR-3,C-3,2024-01-01,2026-11-15,20000.0,Monthly,Yes,Gold',
    'CTR-4,C-4,2024-01-01,2027-06-30,20000.0,Monthly,Yes,Gold',
    'CTR-6,C-6,2024-01-01,2027-12-31,20000.0,Monthly,No,Gold',
    'CTR-8,C-8,2024-01-01,2026-08-31,10000.0,Monthly,Yes,Gold',
  ],
  notes: [
    'N-1,Acme Retail,2026-02-01,L. Brennan,Moving the work to another vendor.',
    'N-4,Delta Stores,2026-07-01,L. Brennan,Missed inspection.',
    'N-8,Hale Hotels,2026-07-01,L. Brennan,Report sent late twice.',
  ],
});

const signal = (noteId: string, risk: NoteSignal['risk']): NoteSignal => ({
  noteId,
  risk,
  reasons: [],
  noteType: 'customer',
  quote: '',
  summary: '',
  quoteVerified: true,
  model: 'm',
  promptVersion: 'v',
});

const inputs: Inputs = { raw, reference, assumptions: assumptionsWith() };
const { model, billing: billingAnalysis } = analyze(inputs);
const signals = [signal('N-1', 'high'), signal('N-4', 'medium'), signal('N-8', 'medium')];
const worklist = buildWorklist(model, billingAnalysis, signals, parameters);
const customer = (id: string) => worklist.customers.find((c) => c.customerId === id);

describe('buildWorklist', () => {
  it('lists every customer once, the groups in the order they are shown and the rest by name', () => {
    const order = worklist.customers.map((c) => [c.customerId, c.group]);
    expect(order).toEqual([
      ['C-7', 'actNow'],
      ['C-8', 'actNow'],
      ['C-3', 'renewals'],
      ['C-4', 'monitor'],
      ['C-1', 'winBack'],
      ['C-6', 'winBack'],
      ['C-2', null],
      ['C-5', null],
    ]);
  });

  it('measures the decline and the amount at stake without atypical invoices', () => {
    const gale = customer('C-7');
    expect(gale?.risk.decline).toMatchObject({ level: 'veryStrong', previous: 100_000, current: 30_000 });
    expect(gale?.risk.level).toBe('high');
    expect(gale?.amountAtStake).toBe(30_000);
  });

  it('takes the amount at stake of a customer that stopped from the twelve months up to its last invoice', () => {
    expect(customer('C-1')?.amountAtStake).toBe(120_000);
    expect(customer('C-6')?.amountAtStake).toBe(20_000);
  });

  it('says why a customer stopped: confirmed in the notes, or the contract still in force', () => {
    expect(customer('C-1')?.stopped).toEqual({ reason: 'confirmedInNotes', noteId: 'N-1' });
    expect(customer('C-6')?.stopped).toEqual({ reason: 'contractActive', noteId: null });
    expect(customer('C-2')?.stopped).toEqual({ reason: 'unknown', noteId: null });
    expect(customer('C-4')?.stopped).toBeNull();
  });

  it('describes the renewal, and marks a healthy auto-renewal so it can be hidden', () => {
    const crane = customer('C-3');
    expect(crane?.renewal).toEqual({
      contractId: 'CTR-3',
      end: '2026-11-15',
      daysToEnd: 46,
      expired: false,
      autoRenew: true,
    });
    expect(crane?.healthyAutoRenewal).toBe(true);
    expect(customer('C-8')?.renewal?.expired).toBe(true);
    expect(customer('C-8')?.healthyAutoRenewal).toBe(false);
  });

  it('gives each status, counting atypical invoices as billing', () => {
    expect(customer('C-3')?.status).toBe('billing');
    expect(customer('C-7')?.lastInvoice).toBe('2026-09-01');
    expect(customer('C-1')?.status).toBe('stopped');
    expect(customer('C-5')?.status).toBe('neverBilled');
  });
});
