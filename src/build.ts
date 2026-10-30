// The model and its billing analysis as one pure function of the inputs: what `npm run pipeline` writes,
// and what the data findings build again with a rule reversed to measure it.

import { analyzeBilling, type BillingAnalysis } from './billing/analyze';
import { buildModel, type Inputs } from './model/build';
import type { Model } from './model/model';

export interface Built {
  model: Model;
  billing: BillingAnalysis;
}

export function build(inputs: Inputs): Built {
  const model = buildModel(inputs);
  const { parameters } = inputs.assumptions;
  const billing = analyzeBilling(model, parameters, inputs.reference.fiscalYearStartMonth);
  return { model, billing };
}
