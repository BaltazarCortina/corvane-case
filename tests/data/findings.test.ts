// Invariants on the findings detected in the real exports.

import { describe, expect, it } from 'vitest';
import { analyze } from '../../src/billing/analyze';
import { detectFindings, type RuleName, withRuleReversed } from '../../src/findings/findings';
import { loadInputs } from '../../src/model/build';
import { paths } from '../../src/paths';
import { contains } from '../../src/shared/calendar';
import { sumMoney } from '../../src/shared/money';

const inputs = loadInputs(paths);
const built = analyze(inputs);
const findings = detectFindings(inputs, built);
const customerIds = new Set(built.model.customers.map((c) => c.id));

describe('findings in the real exports', () => {
  const invoiceRules: RuleName[] = ['duplicateInvoices', 'voidedInvoices', 'creditMemos'];

  it.each(invoiceRules)('reversing %s changes the half total by exactly the invoices it affects', (rule) => {
    const reversed = analyze(withRuleReversed(inputs, rule));
    const period = built.billing.half.window.current;
    const changedAmounts = built.model.invoices.flatMap((invoice, i) => {
      const before = invoice.excludedBy === null;
      const after = reversed.model.invoices[i].excludedBy === null;
      if (before === after || !contains(period, invoice.date)) return [];
      return [after ? invoice.amount : -invoice.amount];
    });
    const expected = sumMoney([built.billing.half.total.current, ...changedAmounts]);
    expect(reversed.billing.half.total.current).toBe(expected);
  });

  it('every assumption names a rule from the config and says what reversing it does', () => {
    for (const finding of findings.filter((f) => f.kind === 'assumption' && f.id !== 'assignments')) {
      expect(finding.rule?.name).toBe(finding.id);
      expect(finding.impact).not.toBeNull();
    }
  });

  it('every case points to an existing customer or to none', () => {
    for (const finding of findings) {
      for (const c of finding.cases) if (c.customerId !== null) expect(customerIds.has(c.customerId)).toBe(true);
    }
  });

  it('no finding is listed without cases', () => {
    for (const finding of findings) expect(finding.cases.length).toBeGreaterThan(0);
  });
});
