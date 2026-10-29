// The evaluation of the real notes. Skipped until the LLM has read them.

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { analyze } from '../../src/analysis/analyze';
import { evaluate } from '../../src/eval/evaluate';
import { loadLabels } from '../../src/eval/labels';
import type { NoteSignal } from '../../src/llm/notes';
import { paths } from '../../src/paths';
import { loadInputs } from '../../src/pipeline/build';

const signalsFile = join(paths.llm, 'note-signals.json');

describe.skipIf(!existsSync(signalsFile))('the evaluation of the real notes', () => {
  it('scores every labeled note, and the groups stand for all the notes', () => {
    const { model, billing } = analyze(loadInputs(paths));
    const json = readFileSync(signalsFile, 'utf8');
    const signals: NoteSignal[] = JSON.parse(json);
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
