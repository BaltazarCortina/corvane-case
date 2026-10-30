import { describe, expect, it } from 'vitest';
import {
  type BilledInvoice,
  billedInvoices,
  byServiceLine,
  compareWindow,
  monthlySeries,
  openAmount,
} from '../../src/billing/billing';
import type { Window } from '../../src/shared/calendar';
import { assumptionsWith, invoice, modelWithInvoices } from '../fixtures';

const { parameters } = assumptionsWith();

const billed = (fields: Partial<BilledInvoice> = {}): BilledInvoice => ({ ...invoice(), atypical: false, ...fields });

const window: Window = {
  previous: { label: 'H1 FY26', start: '2025-04-01', end: '2025-09-30' },
  current: { label: 'H1 FY27', start: '2026-04-01', end: '2026-09-30' },
};

describe('billedInvoices', () => {
  it('keeps only the invoices that count', () => {
    const model = modelWithInvoices([invoice(), invoice({ excludedBy: 'void' })]);
    expect(billedInvoices(model, parameters)).toHaveLength(1);
  });

  it('marks a large invoice as atypical when it is well above the customer’s average month', () => {
    // 10 months of $20k, then a $200k project: the average month is $38k, and $200k is over 1.5 times it.
    const months = Array.from({ length: 10 }, (_, m) =>
      invoice({ date: `2025-${String(m + 1).padStart(2, '0')}-01`, amount: 20_000 }),
    );
    const project = invoice({ date: '2025-10-15', amount: 200_000, serviceLine: 'Project/Install' });
    const model = modelWithInvoices([...months, project]);
    const marks = billedInvoices(model, parameters).map((i) => i.atypical);
    expect(marks.at(-1)).toBe(true);
    expect(marks.slice(0, -1).every((m) => !m)).toBe(true);
  });

  it('never marks an invoice in an excluded line as atypical', () => {
    const model = modelWithInvoices([invoice({ amount: 500_000, serviceLine: 'Monitoring' }), invoice({ amount: 1 })]);
    expect(billedInvoices(model, parameters)[0].atypical).toBe(false);
    const repairsExcluded = { ...parameters, atypicalInvoiceExcludedLines: ['Repair'] };
    const repair = modelWithInvoices([invoice({ amount: 500_000, serviceLine: 'Repair' }), invoice({ amount: 1 })]);
    expect(billedInvoices(repair, repairsExcluded)[0].atypical).toBe(false);
  });

  it('does not mark an invoice below the minimum, or one that is routine for the customer', () => {
    const small = modelWithInvoices([invoice({ amount: 99_999 }), invoice({ date: '2025-06-01', amount: 1 })]);
    expect(billedInvoices(small, parameters)[0].atypical).toBe(false);
    const large = modelWithInvoices([invoice({ amount: 150_000 }), invoice({ date: '2025-04-20', amount: 150_000 })]);
    expect(billedInvoices(large, parameters)[0].atypical).toBe(false);
  });
});

describe('compareWindow', () => {
  const invoices = [
    billed({ date: '2025-05-01', amount: 1000 }),
    billed({ date: '2026-05-01', amount: 900 }),
    billed({ date: '2026-06-01', amount: 300, atypical: true }),
  ];

  it('compares both periods with and without atypical invoices', () => {
    const comparison = compareWindow(invoices, window, '2025-04-01');
    expect(comparison.total).toEqual({ previous: 1000, current: 1200, change: 200, changePct: 20 });
    expect(comparison.withoutAtypical).toEqual({ previous: 1000, current: 900, change: -100, changePct: -10 });
  });

  it('flags a comparison that spans the billing system change', () => {
    expect(compareWindow(invoices, window, '2025-04-01').crossesSystemChange).toBe(false);
    expect(compareWindow(invoices, window, '2026-01-01').crossesSystemChange).toBe(true);
  });

  it('has no percentage when the previous period is empty', () => {
    const comparison = compareWindow([billed({ date: '2026-05-01' })], window, '2025-04-01');
    expect(comparison.total.changePct).toBeNull();
  });
});

describe('byServiceLine', () => {
  it('totals each line in both periods and leaves out lines with none', () => {
    const invoices = [
      billed({ date: '2025-05-01', amount: 100, serviceLine: 'Repair' }),
      billed({ date: '2026-05-01', amount: 300, serviceLine: 'Monitoring' }),
      billed({ date: '2024-01-01', amount: 50, serviceLine: 'Emergency Service' }),
    ];
    expect(byServiceLine(invoices, window)).toEqual([
      { serviceLine: 'Monitoring', current: 300, previous: 0 },
      { serviceLine: 'Repair', current: 0, previous: 100 },
    ]);
  });
});

describe('byServiceLine with credit memos', () => {
  it('reports every credit memo under its own line, whatever line it came with', () => {
    const invoices = [
      billed({ date: '2026-05-01', amount: 300, serviceLine: 'Inspection & Testing' }),
      billed({ date: '2026-05-01', amount: -20, serviceLine: 'Inspection & Testing' }),
      billed({ date: '2026-05-02', amount: -5, serviceLine: 'Credit memos' }),
    ];
    expect(byServiceLine(invoices, window)).toEqual([
      { serviceLine: 'Inspection & Testing', current: 300, previous: 0 },
      { serviceLine: 'Credit memos', current: -25, previous: 0 },
    ]);
  });
});

describe('monthlySeries', () => {
  it('has every month up to the as-of date, empty ones included, and marks a partial last month', () => {
    const invoices = [
      billed({ date: '2026-07-10', amount: 100 }),
      billed({ date: '2026-09-15', amount: 50, atypical: true }),
    ];
    expect(monthlySeries(invoices, '2026-09-15')).toEqual([
      { month: '2026-07', total: 100, withoutAtypical: 100, partial: false },
      { month: '2026-08', total: 0, withoutAtypical: 0, partial: false },
      { month: '2026-09', total: 50, withoutAtypical: 0, partial: true },
    ]);
  });
});

describe('openAmount', () => {
  it('is the share of the period still open, from the new billing system only', () => {
    const invoices = [
      billed({ date: '2026-05-01', amount: 300, status: 'open' }),
      billed({ date: '2026-05-01', amount: 700, status: 'paid' }),
    ];
    expect(openAmount(invoices, window.current)).toEqual({ amount: 300, share: 0.3 });
  });

  it('is unknown for a period with no invoices from the new system', () => {
    const invoices = [billed({ source: 'quickbooks', date: '2026-05-01', status: 'open' })];
    expect(openAmount(invoices, window.current)).toBeNull();
  });
});
