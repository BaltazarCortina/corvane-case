// Runs the pipeline over the exports in data/raw and writes the model to data/build/model.json,
// with a short summary for whoever operates it.

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { paths } from '../src/paths';
import { build, loadInputs } from '../src/pipeline/build';
import type { Model, Tally } from '../src/pipeline/model';

const inputs = loadInputs(paths);
const model = build(inputs);

mkdirSync(paths.build, { recursive: true });
const output = join(paths.build, 'model.json');
const json = JSON.stringify(model);
writeFileSync(output, json);

const summary = summaryLines(model);
console.log(summary.join('\n'));
console.log(`\nWrote ${output}`);

function summaryLines(model: Model): string[] {
  const outsideCrm = model.customers.filter((c) => !c.inCrm).length;
  const unlinkedNotes = model.notes.filter((n) => n.customerId === null).length;
  const unknownEnds = model.contracts.filter((c) => c.end === null).length;
  const duplicateContracts = model.contracts.filter((c) => c.duplicateOf !== null).length;

  const lines = [`Customers  ${model.customers.length}, ${outsideCrm} outside the CRM`];
  for (const r of model.reconciliation) {
    const stated = r.statedTotal === null ? '' : ` (the export states ${usd(r.statedTotal)})`;
    lines.push(
      `${r.source}`,
      `  exported   ${tally(r.exported)}${stated}`,
      `  duplicate  ${tally(r.excluded.duplicate)}`,
      `  void       ${tally(r.excluded.void)}`,
      `  credit     ${tally(r.excluded.credit)}`,
      `  counted    ${tally(r.counted)}`,
      `  unassigned ${tally(r.unassigned)}`,
    );
  }
  lines.push(
    `Contracts  ${model.contracts.length}, ${duplicateContracts} duplicates, ${unknownEnds} with an unknown end`,
    `Notes      ${model.notes.length}, ${unlinkedNotes} linked to no customer`,
  );
  if (model.unmapped.length) lines.push(`Unmapped   ${model.unmapped.length} values, see config/reference.yml`);
  for (const problem of model.configProblems) lines.push(`Config     ${problem}`);
  return lines;
}

function tally(t: Tally): string {
  const rows = String(t.rows).padStart(5);
  const amount = usd(t.amount).padStart(15);
  return `${rows} rows ${amount}`;
}

function usd(amount: number): string {
  const formatted = amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `$${formatted}`;
}
