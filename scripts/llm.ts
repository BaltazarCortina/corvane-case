// Runs the LLM over the model in data/build and writes its output to data/llm: a signal for every account
// note, and the worklist that needs them. Answers are cached, so running again only asks about what
// changed.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { BillingAnalysis } from '../src/analysis/analyze';
import { buildWorklist, WORKLIST_GROUPS, type Worklist } from '../src/analysis/worklist';
import { RISK_LEVELS } from '../src/eval/scale';
import { mapLimit } from '../src/llm/cache';
import { classifyNote, type NoteSignal } from '../src/llm/notes';
import { llmFromEnv } from '../src/llm/provider';
import { paths } from '../src/paths';
import { loadAssumptions } from '../src/pipeline/assumptions';
import type { Model } from '../src/pipeline/model';

const llm = llmFromEnv();
if (!llm) {
  console.error('Set OPENAI_API_KEY in .env to run the LLM steps (see .env.example).');
  process.exit(1);
}

const readJson = <T>(file: string): T => {
  const text = readFileSync(file, 'utf8');
  return JSON.parse(text);
};

const model = readJson<Model>(join(paths.build, 'model.json'));
const billing = readJson<BillingAnalysis>(join(paths.build, 'billing.json'));
const { parameters } = loadAssumptions(paths.assumptions);

console.log(`Reading ${model.notes.length} account notes with ${llm.modelId}...`);
const notesCache = join(paths.llmCache, 'notes');
const signals = await mapLimit(model.notes, 8, (note) => classifyNote(note, llm, notesCache));

const worklist = buildWorklist(model, billing, signals, parameters);

const outputs = { 'note-signals.json': signals, 'worklist.json': worklist };
mkdirSync(paths.llm, { recursive: true });
for (const [file, content] of Object.entries(outputs)) {
  const json = JSON.stringify(content, null, 2);
  writeFileSync(join(paths.llm, file), `${json}\n`);
}

const summary = [...summaryLines(signals), ...worklistLines(worklist)];
console.log(summary.join('\n'));
console.log(`\nWrote ${Object.keys(outputs).join(', ')} to ${paths.llm}`);

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

function worklistLines(worklist: Worklist): string[] {
  const groups = WORKLIST_GROUPS.map((group) => {
    const own = worklist.customers.filter((c) => c.group === group);
    const hidden = own.filter((c) => c.healthyAutoRenewal).length;
    return hidden > 0 ? `${own.length} ${group} (${hidden} healthy auto-renewals)` : `${own.length} ${group}`;
  });
  return [`Worklist   ${groups.join(', ')}`];
}
