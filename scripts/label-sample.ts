// Writes eval/label-sample.csv: a random sample of account notes, with empty columns for a person to
// label. The group each note was drawn from is left out, so it does not hint at the answer.

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { drawSample } from '../src/eval/sample';
import type { Model } from '../src/model/model';
import { paths } from '../src/paths';
import { readJson } from '../src/shared/files';

const model = readJson<Model>(join(paths.build, 'model.json'));
const sample = drawSample(model.notes);

const header = ['note_id', 'date', 'name_as_written', 'text', 'risk', 'reasons', 'note_type', 'comment'];
const rows = sample.map((n) => [n.id, n.date, n.nameAsWritten, n.text, '', '', '', '']);
const lines = [header, ...rows].map((row) => row.map(csvField).join(','));
const output = join(paths.eval, 'label-sample.csv');
writeFileSync(output, `${lines.join('\n')}\n`);
console.log(`Wrote ${sample.length} of ${model.notes.length} notes to ${output}`);

function csvField(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}
