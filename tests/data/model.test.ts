// Invariants on the model built from the real exports.

import { describe, expect, it } from 'vitest';
import { buildModel, loadInputs } from '../../src/model/build';
import { paths } from '../../src/paths';
import { sumMoney } from '../../src/shared/money';

const inputs = loadInputs(paths);
const model = buildModel(inputs);
const customerIds = new Set(model.customers.map((c) => c.id));

describe('the model built from the real exports', () => {
  it.each(model.reconciliation)(
    '$source: the exported total minus each rule gives the counted total, to the cent',
    (r) => {
      const excluded = Object.values(r.excluded);
      const excludedRows = excluded.reduce((total, t) => total + t.rows, 0);
      const excludedAmounts = excluded.map((t) => t.amount);
      const excludedAmount = sumMoney(excludedAmounts);
      const counted = sumMoney([r.exported.amount, -excludedAmount]);
      expect(r.counted.rows).toBe(r.exported.rows - excludedRows);
      expect(r.counted.amount).toBe(counted);
    },
  );

  it('an export that states its total adds up to it', () => {
    for (const r of model.reconciliation) {
      if (r.statedTotal !== null) expect(r.exported.amount).toBe(r.statedTotal);
    }
  });

  it('every invoice belongs to a customer that exists, or is counted as unassigned', () => {
    const unassigned = model.invoices.filter((i) => i.customerId === null && i.excludedBy === null);
    const unassignedRows = model.reconciliation.reduce((total, r) => total + r.unassigned.rows, 0);
    expect(unassigned).toHaveLength(unassignedRows);
    for (const invoice of model.invoices) {
      if (invoice.customerId !== null) expect(customerIds.has(invoice.customerId)).toBe(true);
    }
  });

  it('every contract belongs to a customer that exists', () => {
    for (const contract of model.contracts) expect(customerIds.has(contract.customerId)).toBe(true);
  });

  it("every customer's current contract is one of its own", () => {
    for (const customer of model.customers) {
      if (customer.contractId === null) continue;
      const contract = model.contracts.find((c) => c.id === customer.contractId);
      expect(contract?.customerId).toBe(customer.id);
    }
  });
});
