import { describe, expect, it } from 'vitest';
import {
  addMonths,
  fiscalHalf,
  fiscalYearOf,
  halfWindow,
  lastCompleteHalf,
  monthEnd,
  monthsBetween,
  twelveMonthWindow,
} from '../../src/analysis/calendar';

describe('dates', () => {
  it('finds the end of a month, leap years included', () => {
    expect(monthEnd('2024-02-10')).toBe('2024-02-29');
    expect(monthEnd('2026-09-01')).toBe('2026-09-30');
  });

  it('moves by months, keeping the day when it exists', () => {
    expect(addMonths('2026-09-30', -12)).toBe('2025-09-30');
    expect(addMonths('2024-03-31', -1)).toBe('2024-02-29');
    expect(addMonths('2025-11-15', 3)).toBe('2026-02-15');
  });

  it('lists the months between two dates, both included', () => {
    expect(monthsBetween('2025-11-20', '2026-02-03')).toEqual(['2025-11', '2025-12', '2026-01', '2026-02']);
  });
});

describe('fiscal calendar starting in April', () => {
  it('names a fiscal year by the year it ends in', () => {
    expect(fiscalYearOf('2026-03-31', 4)).toBe(2026);
    expect(fiscalYearOf('2026-04-01', 4)).toBe(2027);
  });

  it('splits a fiscal year into two halves', () => {
    expect(fiscalHalf(2027, 1, 4)).toEqual({ label: 'H1 FY27', start: '2026-04-01', end: '2026-09-30' });
    expect(fiscalHalf(2027, 2, 4)).toEqual({ label: 'H2 FY27', start: '2026-10-01', end: '2027-03-31' });
  });

  it('takes a half as complete only once the as-of date reaches its last day', () => {
    expect(lastCompleteHalf('2026-09-30', 4).label).toBe('H1 FY27');
    expect(lastCompleteHalf('2026-09-29', 4).label).toBe('H2 FY26');
    expect(lastCompleteHalf('2027-01-15', 4).label).toBe('H1 FY27');
  });

  it('compares the last complete half with the same half a year earlier', () => {
    const { current, previous } = halfWindow('2026-09-30', 4);
    expect([current.label, previous.label]).toEqual(['H1 FY27', 'H1 FY26']);
    expect(previous).toMatchObject({ start: '2025-04-01', end: '2025-09-30' });
  });
});

describe('a calendar year fiscal calendar', () => {
  it('names the fiscal year as the calendar year', () => {
    expect(fiscalYearOf('2026-12-31', 1)).toBe(2026);
    expect(fiscalHalf(2026, 2, 1)).toEqual({ label: 'H2 FY26', start: '2026-07-01', end: '2026-12-31' });
  });
});

describe('twelve-month window', () => {
  it('ends on the as-of date and compares with the twelve months before', () => {
    const { current, previous } = twelveMonthWindow('2026-09-30');
    expect(current).toEqual({ label: '12 months to Sep 2026', start: '2025-10-01', end: '2026-09-30' });
    expect(previous).toEqual({ label: '12 months to Sep 2025', start: '2024-10-01', end: '2025-09-30' });
  });

  it('works from a date in the middle of a month', () => {
    const { current } = twelveMonthWindow('2026-09-15');
    expect(current).toMatchObject({ start: '2025-09-16', end: '2026-09-15' });
  });
});
