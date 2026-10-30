import { describe, expect, it } from 'vitest';
import { parseDate, parseMoney } from '../../src/model/values';

describe('parseDate', () => {
  it('reads ISO dates', () => {
    expect(parseDate('2025-04-01')).toBe('2025-04-01');
  });

  it('reads slash dates month first', () => {
    expect(parseDate('04/01/2024')).toBe('2024-04-01');
    expect(parseDate('4/1/2024')).toBe('2024-04-01');
    expect(parseDate('12/31/2024')).toBe('2024-12-31');
  });

  it('reads month name dates', () => {
    expect(parseDate('Apr 01, 2024')).toBe('2024-04-01');
    expect(parseDate('Dec 9, 2024')).toBe('2024-12-09');
  });

  it('ignores surrounding spaces', () => {
    expect(parseDate(' 2025-04-01 ')).toBe('2025-04-01');
  });

  it('rejects days that do not exist', () => {
    expect(parseDate('31/12/2024')).toBeNull();
    expect(parseDate('2025-02-30')).toBeNull();
  });

  it('rejects empty and unknown formats', () => {
    expect(parseDate('')).toBeNull();
    expect(parseDate('Invoice Date')).toBeNull();
    expect(parseDate('01.04.2024')).toBeNull();
  });
});

describe('parseMoney', () => {
  it('reads plain and formatted amounts', () => {
    expect(parseMoney('3379.22')).toBe(3379.22);
    expect(parseMoney('$4,340.27')).toBe(4340.27);
    expect(parseMoney('$37,389,362.29')).toBe(37389362.29);
  });

  it('reads accounting and signed negatives', () => {
    expect(parseMoney('($1,212.32)')).toBe(-1212.32);
    expect(parseMoney('-120.50')).toBe(-120.5);
  });

  it('rejects empty and unknown formats', () => {
    expect(parseMoney('')).toBeNull();
    expect(parseMoney('Amount')).toBeNull();
    expect(parseMoney('$')).toBeNull();
    expect(parseMoney('1,2.3.4')).toBeNull();
  });
});
