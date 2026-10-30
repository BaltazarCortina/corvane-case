// Invariants on the customer stories of the real data. Skipped until `npm run llm` has written them.

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { analyze } from '../../src/billing/analyze';
import { billedInvoices } from '../../src/billing/billing';
import { detectFindings } from '../../src/findings/findings';
import { loadInputs } from '../../src/model/build';
import { paths } from '../../src/paths';
import type { NoteSignal } from '../../src/risk/notes';
import { buildWorklist } from '../../src/risk/worklist';
import { type CustomerStory, storyInputs } from '../../src/stories/stories';
import { verifyStory } from '../../src/stories/verify';

const signalsFile = join(paths.llm, 'note-signals.json');
const storiesFile = join(paths.llm, 'stories.json');
const ready = existsSync(signalsFile) && existsSync(storiesFile);

const readJson = <T>(file: string): T => {
  const text = readFileSync(file, 'utf8');
  return JSON.parse(text);
};

describe.skipIf(!ready)('the customer stories of the real data', () => {
  const inputs = loadInputs(paths);
  const built = analyze(inputs);
  const { parameters } = inputs.assumptions;
  const signals = ready ? readJson<NoteSignal[]>(signalsFile) : [];
  const stories = ready ? readJson<CustomerStory[]>(storiesFile) : [];
  const worklist = buildWorklist(built.model, built.billing, signals, parameters);
  const findings = detectFindings(inputs, built);
  const invoices = billedInvoices(built.model, parameters);
  const needed = storyInputs(built.model, built.billing, worklist, findings, invoices, parameters);

  it('cover every customer that needs one, from the facts and notes of the current data', () => {
    const storyIds = stories.map((s) => s.customerId);
    const neededIds = needed.map((n) => n.assessment.customerId);
    expect(storyIds).toEqual(neededIds);
    for (const [i, story] of stories.entries()) {
      expect(story.facts).toEqual(needed[i].facts);
      expect(story.noteIds).toEqual(needed[i].notes.map((n) => n.id));
      expect(story.asOf).toBe(built.billing.asOf);
    }
  });

  it('carry the result the verifier gives today', () => {
    for (const [i, story] of stories.entries()) {
      const check = verifyStory(story, needed[i].facts, needed[i].notes);
      expect(story.check).toEqual(check);
    }
  });
});
