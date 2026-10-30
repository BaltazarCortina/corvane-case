// The model as one pure function: raw exports + reference data + assumptions → model.

import { type Assumptions, loadAssumptions } from './assumptions';
import { loadExports, type RawExports } from './exports';
import { assembleModel, type Model } from './model';
import { parseExports } from './parse';
import { loadReference, type Reference } from './reference';
import { resolveCustomers } from './resolve';

export interface Inputs {
  raw: RawExports;
  reference: Reference;
  assumptions: Assumptions;
}

export function buildModel({ raw, reference, assumptions }: Inputs): Model {
  const parsed = parseExports(raw, reference);
  const resolution = resolveCustomers(parsed, assumptions);
  const model = assembleModel(parsed, resolution, assumptions);
  const parameterProblems = checkParameters(assumptions, reference);
  return { ...model, configProblems: [...model.configProblems, ...parameterProblems] };
}

/** Parameters that name values the reference data does not know, so a typo does not go unnoticed. */
function checkParameters(assumptions: Assumptions, reference: Reference): string[] {
  const serviceLines = Object.keys(reference.serviceLines);
  const unknown = assumptions.parameters.atypicalInvoiceExcludedLines.filter((l) => !serviceLines.includes(l));
  return unknown.map((line) => `atypical invoice excluded line ${line} is not a service line`);
}

export function loadInputs(files: { raw: string; reference: string; assumptions: string }): Inputs {
  const raw = loadExports(files.raw);
  const reference = loadReference(files.reference);
  const assumptions = loadAssumptions(files.assumptions);
  return { raw, reference, assumptions };
}
