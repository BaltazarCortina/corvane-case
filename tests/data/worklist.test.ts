// Invariants on the worklist of the real data. Skipped until `npm run llm` has read the notes.

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { analyze } from '../../src/analysis/analyze';
import { buildWorklist, type Worklist } from '../../src/analysis/worklist';
import type { NoteSignal } from '../../src/llm/notes';
import { paths } from '../../src/paths';
import { loadInputs } from '../../src/pipeline/build';

const signalsFile = join(paths.llm, 'note-signals.json');

/** Escalations to the customer's management with a demand for credits: high to a person, medium to the LLM. */
const ESCALATION_NOTES = ['N-5414', 'N-5437', 'N-5597'];

describe.skipIf(!existsSync(signalsFile))('the worklist of the real data', () => {
  const inputs = loadInputs(paths);
  const { model, billing } = analyze(inputs);
  const { parameters } = inputs.assumptions;
  const signals: NoteSignal[] = existsSync(signalsFile) ? JSON.parse(readFileSync(signalsFile, 'utf8')) : [];
  const worklist = buildWorklist(model, billing, signals, parameters);
  const groupsOf = (w: Worklist) => w.customers.map((c) => [c.customerId, c.group]);

  it('assesses every customer once', () => {
    const assessed = worklist.customers.map((c) => c.customerId).sort();
    const customers = model.customers.map((c) => c.id).sort();
    expect(assessed).toEqual(customers);
  });

  it('keeps every customer at high risk that still bills in Act now', () => {
    const highAndBilling = worklist.customers.filter((c) => c.risk.level === 'high' && c.status === 'billing');
    const groups = highAndBilling.map((c) => c.group);
    expect(new Set(groups)).toEqual(new Set(['actNow']));
  });

  it('places every customer the same if the escalation notes the LLM reads as medium were high', () => {
    const asPersonReads = signals.map((s) =>
      ESCALATION_NOTES.includes(s.noteId) ? { ...s, risk: 'high' as const } : s,
    );
    const escalations = signals.filter((s) => ESCALATION_NOTES.includes(s.noteId));
    const reread = buildWorklist(model, billing, asPersonReads, parameters);
    expect(escalations.map((s) => s.risk)).toEqual(['medium', 'medium', 'medium']);
    expect(groupsOf(reread)).toEqual(groupsOf(worklist));
  });
});
