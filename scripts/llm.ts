// Runs the LLM over the model in data/build and writes its output to data/llm: a signal for every account
// note, the worklist that needs them, and a story for the worklist customers with notes. Answers are
// cached, so running again only asks about what changed.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { BillingAnalysis } from '../src/billing/analyze';
import { billedInvoices } from '../src/billing/billing';
import type { Finding } from '../src/findings/findings';
import { mapLimit } from '../src/llm/cache';
import { llmFromEnv } from '../src/llm/provider';
import { loadAssumptions } from '../src/model/assumptions';
import type { Model } from '../src/model/model';
import { paths } from '../src/paths';
import { classifyNote, type NoteSignal } from '../src/risk/notes';
import { RISK_LEVELS } from '../src/risk/scale';
import { buildWorklist, WORKLIST_GROUPS, type Worklist } from '../src/risk/worklist';
import { type CustomerStory, storyInputs, writeStory } from '../src/stories/stories';

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
const findings = readJson<Finding[]>(join(paths.build, 'findings.json'));
const { parameters } = loadAssumptions(paths.assumptions);

console.log(`Reading ${model.notes.length} account notes with ${llm.modelId}...`);
const notesCache = join(paths.llmCache, 'notes');
const signals = await mapLimit(model.notes, 8, (note) => classifyNote(note, llm, notesCache));

const worklist = buildWorklist(model, billing, signals, parameters);

const invoices = billedInvoices(model, parameters);
const inputs = storyInputs(model, billing, worklist, findings, invoices, parameters);
console.log(`Writing ${inputs.length} customer stories...`);
const storiesCache = join(paths.llmCache, 'stories');
const stories = await mapLimit(inputs, 8, (input) => writeStory(input, llm, storiesCache, billing.asOf));

const outputs = { 'note-signals.json': signals, 'worklist.json': worklist, 'stories.json': stories };
mkdirSync(paths.llm, { recursive: true });
for (const [file, content] of Object.entries(outputs)) {
  const json = JSON.stringify(content, null, 2);
  writeFileSync(join(paths.llm, file), `${json}\n`);
}

const summary = [...summaryLines(signals), ...worklistLines(worklist), ...storyLines(stories)];
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

function storyLines(stories: CustomerStory[]): string[] {
  const failed = stories.filter((s) => !s.check.ok);
  const problems = failed.reduce((total, s) => total + s.check.problems.length, 0);
  const verified = `${stories.length - failed.length} of ${stories.length} pass every check`;
  return [`Stories    ${failed.length === 0 ? verified : `${verified}; ${problems} problems in ${failed.length}`}`];
}
