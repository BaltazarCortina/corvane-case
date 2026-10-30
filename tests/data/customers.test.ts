// Invariants on how the real exports resolve to customers.

import { describe, expect, it } from 'vitest';
import { loadAssumptions } from '../../src/model/assumptions';
import { loadExports } from '../../src/model/exports';
import { parseExports } from '../../src/model/parse';
import { loadReference } from '../../src/model/reference';
import { resolveCustomers } from '../../src/model/resolve';
import { paths } from '../../src/paths';

const parsed = parseExports(loadExports(paths.raw), loadReference(paths.reference));
const resolution = resolveCustomers(parsed, loadAssumptions(paths.assumptions));
const customerIds = new Set(resolution.customers.map((c) => c.id));

describe('customers in the real exports', () => {
  it('every CRM id and every id billed or contracted belongs to one customer', () => {
    const ids = [
      ...parsed.crm.map((r) => r.id),
      ...parsed.netsuite.map((i) => i.customerId),
      ...parsed.contracts.map((c) => c.customerId),
    ];
    for (const id of ids) expect(customerIds.has(resolution.customerOfId[id])).toBe(true);
  });

  it('every QuickBooks and note name is linked to a customer or listed as unmatched', () => {
    const links = [
      ...parsed.quickbooks.map((i) => resolution.quickbooksNames[i.customerName]),
      ...parsed.notes.map((n) => resolution.noteNames[n.customerName]),
    ];
    for (const link of links) {
      expect(link).toBeDefined();
      if (link.customerId !== null) expect(customerIds.has(link.customerId)).toBe(true);
    }
  });

  it('the assumptions file points only to things in the data', () => {
    expect(resolution.configProblems).toEqual([]);
  });
});
