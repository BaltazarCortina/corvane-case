// Scores the LLM's reading of the account notes and writes the report to data/llm/eval-report.json.
// Needs `npm run pipeline`, `npm run llm` and the hand labels in eval/labels.csv.

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { BillingAnalysis } from '../src/analysis/analyze';
import { type EvaluationReport, evaluate } from '../src/eval/evaluate';
import { loadLabels } from '../src/eval/labels';
import type { NoteSignal } from '../src/llm/notes';
import { paths } from '../src/paths';
import type { Model } from '../src/pipeline/model';

const readJson = <T>(file: string): T => {
  const text = readFileSync(file, 'utf8');
  return JSON.parse(text);
};

const model = readJson<Model>(join(paths.build, 'model.json'));
const billing = readJson<BillingAnalysis>(join(paths.build, 'billing.json'));
const signals = readJson<NoteSignal[]>(join(paths.llm, 'note-signals.json'));
const labels = loadLabels(join(paths.eval, 'labels.csv'));
const evaluatedAt = new Date().toISOString().slice(0, 10);

const report = evaluate(model, billing, signals, labels, evaluatedAt);
const output = join(paths.llm, 'eval-report.json');
const json = JSON.stringify(report, null, 2);
writeFileSync(output, `${json}\n`);

const summary = summaryLines(report);
console.log(summary.join('\n'));
console.log(`\nWrote ${output}`);

function summaryLines(r: EvaluationReport): string[] {
  const pct = (value: number | null) => (value === null ? 'n/a' : `${Math.round(value * 100)}%`);
  const groups = r.groups.map((g) => `${g.labeled} of ${g.notes} ${g.group}`).join(', ');
  const lines = [
    `${r.model}, prompt ${r.promptVersion}, evaluated ${r.evaluatedAt}. Labeled: ${groups}.`,
    '',
    'Against the hand labels (weighted to all notes)',
    `  LLM       at risk: precision ${pct(r.llm.atRisk.precision)}, recall ${pct(r.llm.atRisk.recall)}; same level ${pct(r.llm.sameRisk)}; same note type ${pct(r.llm.sameNoteType)}; reasons recall ${pct(r.llm.reasons.recall)}, precision ${pct(r.llm.reasons.precision)}`,
    `  Keywords  at risk: precision ${pct(r.keywordBaseline.precision)}, recall ${pct(r.keywordBaseline.recall)}`,
    '',
    `Disagreements: ${r.disagreements.length}`,
    ...r.disagreements.map(
      (d) => `  ${d.noteId} label ${d.label.risk}/${d.label.noteType}, LLM ${d.llm.risk}/${d.llm.noteType}: ${d.text}`,
    ),
    '',
    'Billing check (half against half, by the highest risk in the last twelve months of notes)',
    ...r.billingCheck.map(
      (b) =>
        `  ${b.notesSay.padEnd(9)} ${String(b.customers).padStart(3)} customers, median ${b.medianChangePct === null ? 'n/a' : `${b.medianChangePct.toFixed(1)}%`}, billing less ${pct(b.billingLess)}`,
    ),
  ];
  return lines;
}
