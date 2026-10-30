// Runs the pipeline over the exports in data/raw and writes everything that does not need the LLM to
// data/build: the model, the billing analysis and the data findings. Nothing downstream recomputes them.

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { analyze } from '../src/billing/analyze';
import { detectFindings, type Finding } from '../src/findings/findings';
import { loadInputs } from '../src/model/build';
import type { Model, Tally } from '../src/model/model';
import { paths } from '../src/paths';

const inputs = loadInputs(paths);
const built = analyze(inputs);
const findings = detectFindings(inputs, built);

const outputs = { 'model.json': built.model, 'billing.json': built.billing, 'findings.json': findings };
mkdirSync(paths.build, { recursive: true });
for (const [file, content] of Object.entries(outputs)) {
  const json = JSON.stringify(content);
  writeFileSync(join(paths.build, file), json);
}

const summary = [...summaryLines(built.model), ...findingLines(findings)];
console.log(summary.join('\n'));
console.log(`\nWrote ${Object.keys(outputs).join(', ')} to ${paths.build}`);

function findingLines(findings: Finding[]): string[] {
  const assumptions = findings.filter((f) => f.kind === 'assumption').length;
  const toCheck = findings.filter((f) => f.kind === 'observation' && f.worthChecking).length;
  const informative = findings.length - assumptions - toCheck;
  return [`Findings   ${assumptions} assumptions, ${toCheck} observations worth checking, ${informative} informative`];
}

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
