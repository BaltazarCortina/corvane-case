import { describe, expect, it } from 'vitest';
import type { BilledInvoice } from '../../src/analysis/billing';
import { bridge } from '../../src/analysis/bridge';
import type { Window } from '../../src/analysis/calendar';
import { invoice } from '../fixtures';

const window: Window = {
  previous: { label: 'H1 FY26', start: '2025-04-01', end: '2025-09-30' },
  current: { label: 'H1 FY27', start: '2026-04-01', end: '2026-09-30' },
};

const before = '2025-05-01';
const after = '2026-05-01';

const billed = (customerId: string | null, date: string, amount: number, atypical = false): BilledInvoice => ({
  ...invoice({ customerId, date, amount }),
  atypical,
});

const invoices = [
  billed('stopped', before, 500),
  billed('less', before, 400),
  billed('less', after, 100),
  billed('more', before, 100),
  billed('more', after, 150),
  billed('more', after, 200, true),
  billed('new', after, 80),
  billed('flat', before, 70),
  billed('flat', after, 70),
  billed(null, after, 10),
  billed('outside', '2024-01-01', 999),
];

describe('bridge', () => {
  const result = bridge(invoices, window);
  const step = (kind: string) => result.steps.find((s) => s.kind === kind);

  it('sorts each customer into stopped, less, more or new, largest change first', () => {
    const customers = result.steps.map((s) => [s.kind, s.movers.map((m) => m.customerId)]);
    expect(customers).toEqual([
      ['stopped', ['stopped']],
      ['less', ['less']],
      ['more', ['more']],
      ['new', ['new', null]],
    ]);
  });

  it('adds up from the previous total to the current one', () => {
    expect(result.previous).toBe(1070);
    expect(result.current).toBe(610);
    const changes = result.steps.map((s) => s.change);
    const total = changes.reduce((sum, c) => sum + c, 0);
    expect(result.previous + total).toBe(result.current);
  });

  it('says how much of each change comes from atypical invoices', () => {
    expect(step('more')?.movers[0]).toMatchObject({ previous: 100, current: 350, change: 250, atypicalChange: 200 });
  });

  it('counts invoices with no customer as their own mover', () => {
    expect(step('new')?.movers).toContainEqual(expect.objectContaining({ customerId: null, change: 10 }));
  });
});
