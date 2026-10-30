import { describe, expect, it } from 'vitest';
import { holds, parseAssumptions, type Rule } from '../../src/model/assumptions';

const valid = `
parameters:
  atypicalInvoiceExcludedLines: []
  atypicalInvoiceMinimum: 100000
  atypicalInvoiceMultiple: 1.5
  stoppedBillingDays: 90
  underBilledContractShare: 0.5
  overBilledContractShare: 1.5
  minimumDeclineAmount: 10000
  moderateDeclineShare: 0.1
  strongDeclineShare: 0.25
  veryStrongDeclineShare: 0.5
  actNowRenewalDays: 90
  upcomingRenewalDays: 180
  winBackMonths: 12
duplicateCustomers: { applies: true, confirmed: false, basis: b }
shortenedNoteNames: { applies: true, confirmed: false, basis: b }
duplicateInvoices: { applies: true, confirmed: false, basis: b }
voidedInvoices: { applies: true, confirmed: false, basis: b }
creditMemos: { applies: true, confirmed: false, basis: b }
impossibleContractDates: { applies: true, confirmed: false, basis: b }
`;

describe('parseAssumptions', () => {
  it('fills empty exceptions and assignments', () => {
    const a = parseAssumptions(valid);
    expect(a.duplicateCustomers.exceptions).toEqual([]);
    expect(a.assignments).toEqual([]);
  });

  it('fails on a value of the wrong type with its path', () => {
    expect(() => parseAssumptions(valid.replace('applies: true', 'applies: maybe'))).toThrow(
      /duplicateCustomers\.applies/,
    );
  });

  it('fails on an incomplete assignment with its path', () => {
    const text = `${valid}assignments: [{ source: quickbooks, value: Acme, customer: C-1 }]`;
    expect(() => parseAssumptions(text)).toThrow(/assignments\.0\.confirmed/);
  });

  it('fails on thresholds out of order', () => {
    expect(() => parseAssumptions(valid.replace('strongDeclineShare: 0.25', 'strongDeclineShare: 0.6'))).toThrow(
      /decline shares must grow/,
    );
    expect(() => parseAssumptions(valid.replace('actNowRenewalDays: 90', 'actNowRenewalDays: 200'))).toThrow(
      /actNowRenewalDays/,
    );
  });

  it('fails on a misspelled key instead of ignoring it', () => {
    expect(() => parseAssumptions(valid.replace('basis: b }', 'basis: b, confirmd: true }'))).toThrow(/confirmd/);
  });
});

describe('holds', () => {
  const rule = (applies: boolean, exceptions: string[] = []): Rule => ({
    applies,
    confirmed: false,
    basis: '',
    exceptions,
  });

  it('follows the rule unless the case is an exception', () => {
    expect(holds(rule(true), 'a')).toBe(true);
    expect(holds(rule(true, ['a']), 'a')).toBe(false);
    expect(holds(rule(false), 'a')).toBe(false);
    expect(holds(rule(false, ['a']), 'a')).toBe(true);
  });

  it('does not hold for a case the rule does not cover, unless it is an exception', () => {
    expect(holds(rule(true), 'a', false)).toBe(false);
    expect(holds(rule(true, ['a']), 'a', false)).toBe(true);
  });
});
