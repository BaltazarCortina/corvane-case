import { describe, expect, it } from 'vitest';
import { sumMoney } from '../../src/shared/money';

describe('sumMoney', () => {
  it('adds in cents, without floating point drift', () => {
    expect(sumMoney([0.1, 0.2])).toBe(0.3);
    expect(sumMoney([1200.5, -300.25, 0.01])).toBe(900.26);
  });

  it('is zero for no amounts', () => {
    expect(sumMoney([])).toBe(0);
  });
});
