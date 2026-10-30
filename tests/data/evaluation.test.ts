// The evaluation of the real notes. Skipped until the LLM has read them.

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { build } from '../../src/build';
import { evaluate } from '../../src/eval/evaluate';
import { loadLabels } from '../../src/eval/labels';
import { loadInputs } from '../../src/model/build';
import { paths } from '../../src/paths';
import type { NoteSignal } from '../../src/risk/notes';
import { readJson } from '../../src/shared/files';

const signalsFile = join(paths.build, 'note-signals.json');

describe.skipIf(!existsSync(signalsFile))('the evaluation of the real notes', () => {
  it('scores every labeled note, and the groups stand for all the notes', () => {
    const { model, billing } = build(loadInputs(paths));
    const signals = readJson<NoteSignal[]>(signalsFile);
    const labels = loadLabels(join(paths.eval, 'labels.csv'));
    const report = evaluate(model, billing, signals, labels, '2026-01-01');
    const notes = report.groups.reduce((total, g) => total + g.notes, 0);
    const labeled = report.groups.reduce((total, g) => total + g.labeled, 0);
    const counts = Object.values(report.llm.atRisk.counts).reduce((total, n) => total + n, 0);
    expect(notes).toBe(model.notes.length);
    expect(labeled).toBe(labels.length);
    expect(counts).toBe(labels.length);
  });
});
