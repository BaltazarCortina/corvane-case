// Invariants on the billing analysis of the real exports.

import { describe, expect, it } from 'vitest';
import { analyzeBilling } from '../../src/analysis/analyze';
import { paths } from '../../src/paths';
import { build, loadInputs } from '../../src/pipeline/build';
import { sumMoney } from '../../src/pipeline/money';

const inputs = loadInputs(paths);
const model = build(inputs);
const billing = analyzeBilling(model, inputs.assumptions.parameters, inputs.reference.fiscalYearStartMonth);

describe('billing from the real exports', () => {
  it('compares two complete periods', () => {
    for (const { window } of [billing.half, billing.twelveMonths]) {
      expect(window.current.end <= billing.asOf).toBe(true);
      expect(window.previous.end < window.current.start).toBe(true);
    }
  });

  it('the bridge adds up from the previous half to the current one, to the cent', () => {
    const changes = billing.bridge.steps.map((s) => s.change);
    const end = sumMoney([billing.bridge.previous, ...changes]);
    expect(end).toBe(billing.bridge.current);
  });

  it('the bridge starts and ends at the half totals', () => {
    expect(billing.bridge.previous).toBe(billing.half.total.previous);
    expect(billing.bridge.current).toBe(billing.half.total.current);
  });

  it('the service lines add up to the half totals', () => {
    const current = billing.serviceLines.map((l) => l.current);
    const previous = billing.serviceLines.map((l) => l.previous);
    expect(sumMoney(current)).toBe(billing.half.total.current);
    expect(sumMoney(previous)).toBe(billing.half.total.previous);
  });

  it('the months add up to everything counted in the model', () => {
    const months = billing.months.map((m) => m.total);
    const counted = model.reconciliation.map((r) => r.counted.amount);
    expect(sumMoney(months)).toBe(sumMoney(counted));
  });
});
