// Runs the LLM over the model in data/build and writes its output to data/llm: a signal for every account
// note. Answers are cached, so running again only asks about what changed.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { RISK_LEVELS } from '../src/eval/scale';
import { mapLimit } from '../src/llm/cache';
import { classifyNote, type NoteSignal } from '../src/llm/notes';
import { llmFromEnv } from '../src/llm/provider';
import { paths } from '../src/paths';
import type { Model } from '../src/pipeline/model';

const llm = llmFromEnv();
if (!llm) {
  console.error('Set OPENAI_API_KEY in .env to run the LLM steps (see .env.example).');
  process.exit(1);
}

const modelJson = readFileSync(join(paths.build, 'model.json'), 'utf8');
const model: Model = JSON.parse(modelJson);

console.log(`Reading ${model.notes.length} account notes with ${llm.modelId}...`);
const notesCache = join(paths.llmCache, 'notes');
const signals = await mapLimit(model.notes, 8, (note) => classifyNote(note, llm, notesCache));

mkdirSync(paths.llm, { recursive: true });
const output = join(paths.llm, 'note-signals.json');
const json = JSON.stringify(signals, null, 2);
writeFileSync(output, `${json}\n`);

const summary = summaryLines(signals);
console.log(summary.join('\n'));
console.log(`\nWrote ${output}`);

function summaryLines(signals: NoteSignal[]): string[] {
  const byRisk = RISK_LEVELS.map((risk) => `${signals.filter((s) => s.risk === risk).length} ${risk}`);
  const prospects = signals.filter((s) => s.noteType === 'prospect').length;
  const unverified = signals.filter((s) => !s.quoteVerified).map((s) => s.noteId);
  return [
    `Risk       ${byRisk.join(', ')}`,
    `Prospects  ${prospects}`,
    `Quotes     ${unverified.length === 0 ? 'all verbatim' : `not found in the note: ${unverified.join(', ')}`}`,
  ];
}
