import { describe, expect, it } from 'vitest';
import { lookup, parseReference } from '../../src/pipeline/reference';

describe('lookup', () => {
  const state = lookup({ OH: ['Oh.', 'Ohio'], IN: ['Indiana'] });

  it('maps every spelling and the canonical value itself, ignoring case and spaces', () => {
    expect(state('Ohio')).toBe('OH');
    expect(state('oh.')).toBe('OH');
    expect(state(' OH ')).toBe('OH');
    expect(state('in')).toBe('IN');
  });

  it('returns null for an unknown value', () => {
    expect(state('Iowa')).toBeNull();
  });

  it('fails when a spelling belongs to two canonical values', () => {
    expect(() => lookup({ Retail: ['Stores'], Hospitality: ['stores'] })).toThrow(/both "Retail" and "Hospitality"/);
  });
});

describe('parseReference', () => {
  it('fails with the path of the invalid entry', () => {
    const text = 'states: {}\nindustries: {}\nserviceLines:\n  Repair: Valve repair\n';
    expect(() => parseReference(text)).toThrow(/serviceLines\.Repair/);
  });
});
