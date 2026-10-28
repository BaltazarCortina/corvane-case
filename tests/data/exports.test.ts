// Invariants on the real exports: they hold for any export with the same structure, so they keep
// holding when new files arrive.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { paths } from '../../src/paths';
import { EXPORTS, type ExportName, loadExports } from '../../src/pipeline/exports';
import { parseExports } from '../../src/pipeline/parse';
import { loadReference } from '../../src/pipeline/reference';

const parsed = parseExports(loadExports(paths.raw), loadReference(paths.reference));

describe('the real exports', () => {
  it.each(Object.keys(EXPORTS) as ExportName[])('%s: every line is a parsed row or a known non-data line', (name) => {
    const lines = readFileSync(join(paths.raw, EXPORTS[name].file), 'utf8')
      .split('\n')
      .filter((l) => l.trim());
    const rows = parsed[name].length + parsed.nonDataLines.filter((l) => l.export === name).length;
    expect(rows).toBe(lines.length - 1);
  });

  it('QuickBooks invoices add up to the total the export states', () => {
    const totals = parsed.nonDataLines.filter((l) => l.export === 'quickbooks' && l.kind === 'total');
    expect(totals).toHaveLength(1);
    const sum = parsed.quickbooks.reduce((acc, i) => acc + i.amount, 0);
    expect(sum).toBeCloseTo(totals[0].amount ?? Number.NaN, 2);
  });

  it('the reference data covers every state, industry and service line in the exports', () => {
    expect(parsed.unmapped).toEqual([]);
  });
});
