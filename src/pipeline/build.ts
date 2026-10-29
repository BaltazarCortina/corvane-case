// The whole pipeline as one pure function: raw exports + reference data + assumptions → model.

import { type Assumptions, loadAssumptions } from './assumptions';
import { loadExports, type RawExports } from './exports';
import { buildModel, type Model } from './model';
import { parseExports } from './parse';
import { loadReference, type Reference } from './reference';
import { resolveCustomers } from './resolve';

export interface Inputs {
  raw: RawExports;
  reference: Reference;
  assumptions: Assumptions;
}

export function build({ raw, reference, assumptions }: Inputs): Model {
  const parsed = parseExports(raw, reference);
  const resolution = resolveCustomers(parsed, assumptions);
  return buildModel(parsed, resolution, assumptions);
}

export function loadInputs(files: { raw: string; reference: string; assumptions: string }): Inputs {
  const raw = loadExports(files.raw);
  const reference = loadReference(files.reference);
  const assumptions = loadAssumptions(files.assumptions);
  return { raw, reference, assumptions };
}
