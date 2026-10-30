// The hand labels cover exactly the sample drawn from the real notes, with valid values. Skipped until
// eval/labels.csv exists.

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadLabels } from '../../src/eval/labels';
import { drawSample } from '../../src/eval/sample';
import { build, loadInputs } from '../../src/model/build';
import { paths } from '../../src/paths';

const labelsFile = join(paths.eval, 'labels.csv');

describe.skipIf(!existsSync(labelsFile))('the hand labels', () => {
  it('label every note of the sample, and only those', () => {
    const model = build(loadInputs(paths));
    const sample = drawSample(model.notes);
    const labels = loadLabels(labelsFile);
    const labeled = labels.map((l) => l.noteId).sort();
    const sampled = sample.map((n) => n.id).sort();
    expect(labeled).toEqual(sampled);
  });
});
