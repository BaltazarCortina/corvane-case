import { describe, expect, it } from 'vitest';
import { analyze } from '../../src/billing/analyze';
import { billedInvoices } from '../../src/billing/billing';
import { detectFindings } from '../../src/findings/findings';
import type { Inputs } from '../../src/model/build';
import type { Reference } from '../../src/model/reference';
import type { NoteSignal } from '../../src/risk/notes';
import { buildWorklist } from '../../src/risk/worklist';
import { storyInputs, storyPrompt } from '../../src/stories/stories';
import { assumptionsWith, exportsWith } from '../fixtures';

const reference: Reference = {
  fiscalYearStartMonth: 4,
  states: {},
  industries: {},
  serviceLines: { Repair: [] },
};

// As of 2026-09-30. Acme is at high risk with two notes, written down out of order and with a credit memo;
// Bolt is a renewal with a note; Crane's billing fell, but it has no notes to read.
const raw = exportsWith({
  crm: [
    'C-1,Acme Retail,Retail,Toledo,OH,L. Brennan,2020-01-01,Active',
    'C-2,Bolt Logistics,Logistics,Toledo,OH,L. Brennan,2020-01-01,Active',
    'C-3,Crane Inns,Hospitality,Toledo,OH,,2020-01-01,Active',
  ],
  netsuite: [
    'NS-1,C-1,2025-06-01,20000.00,USD,paid,Repair',
    'NS-2,C-1,2026-06-01,-1000.00,USD,paid,Repair',
    'NS-3,C-1,2026-08-01,21000.00,USD,paid,Repair',
    'NS-4,C-2,2025-06-01,5000.00,USD,paid,Repair',
    'NS-5,C-2,2026-09-30,5000.00,USD,paid,Repair',
    'NS-6,C-3,2025-06-01,50000.00,USD,paid,Repair',
    'NS-7,C-3,2026-08-01,30000.00,USD,paid,Repair',
  ],
  contracts: ['CTR-2,C-2,2024-01-01,2026-10-30,10000.0,Monthly,Yes,Gold'],
  notes: [
    'N-2,Acme Retail,2026-07-01,L. Brennan,Asked for the termination terms.',
    'N-1,Acme Retail,2026-02-01,L. Brennan,Missed inspection.',
    'N-3,Bolt Logistics,2026-03-01,L. Brennan,Routine visit.',
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

const assumptions = assumptionsWith();
const inputs: Inputs = { raw, reference, assumptions };
const built = analyze(inputs);
const findings = detectFindings(inputs, built);
const signals = [signal('N-1', 'medium'), signal('N-2', 'high'), signal('N-3', 'none')];
const worklist = buildWorklist(built.model, built.billing, signals, assumptions.parameters);
const invoices = billedInvoices(built.model, assumptions.parameters);
const stories = storyInputs(built.model, built.billing, worklist, findings, invoices, assumptions.parameters);

describe('storyInputs', () => {
  it('writes stories only for the worklist groups that need one, and only from notes', () => {
    const groups = worklist.customers.map((c) => [c.customerId, c.group]);
    expect(groups).toEqual([
      ['C-1', 'actNow'],
      ['C-2', 'renewals'],
      ['C-3', 'monitor'],
    ]);
    expect(stories.map((s) => s.assessment.customerId)).toEqual(['C-1']);
  });

  it('gives the notes oldest first', () => {
    expect(stories[0].notes.map((n) => n.id)).toEqual(['N-1', 'N-2']);
  });

  it('numbers the facts and writes their amounts the way the app does', () => {
    const { facts } = stories[0];
    const ids = facts.map((f) => f.id);
    const texts = facts.map((f) => f.text);
    expect(ids.slice(0, 3)).toEqual(['F1', 'F2', 'F3']);
    expect(texts).toContain('Billing without atypical invoices, H1 FY26 $20k, H1 FY27 $20k (0.0%).');
    expect(texts).toContain('No contract on file.');
    expect(texts).toContain('Data finding, Credit memos: NS-2 on 2026-06-01, −$1k.');
  });
});

describe('storyPrompt', () => {
  it('sends the facts by id and the notes with their date and author', () => {
    const prompt = storyPrompt(stories[0]);
    expect(prompt.startsWith('Customer: Acme Retail\n\nFacts:\nF1: Acme Retail: Retail, Toledo, OH;')).toBe(true);
    expect(
      prompt.endsWith(
        'Notes, oldest first:\nN-1, 2026-02-01, L. Brennan: Missed inspection.\nN-2, 2026-07-01, L. Brennan: Asked for the termination terms.',
      ),
    ).toBe(true);
  });
});
