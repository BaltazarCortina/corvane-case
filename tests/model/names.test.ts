import { describe, expect, it } from 'vitest';
import { hasLegalSuffix, isAllCaps, normalizeName } from '../../src/model/names';

describe('normalizeName', () => {
  it('ignores case, punctuation and trailing legal suffixes', () => {
    expect(normalizeName('GRANVILLE INNS')).toBe('granville inns');
    expect(normalizeName('Carrow Market Group, Inc.')).toBe('carrow market group');
    expect(normalizeName('Corbin School District LLC')).toBe('corbin school district');
    expect(normalizeName('Fenwick Manufacturing.')).toBe('fenwick manufacturing');
  });

  it('reads & as and', () => {
    expect(normalizeName('Smith & Sons')).toBe(normalizeName('Smith and Sons'));
  });

  it('keeps different companies with a shared word apart', () => {
    expect(normalizeName('Halloran Academy')).not.toBe(normalizeName('Halloran Health Partners'));
  });

  it('keeps a name that is only a suffix-like word', () => {
    expect(normalizeName('Inc')).toBe('inc');
  });
});

describe('hasLegalSuffix', () => {
  it('detects a trailing legal suffix with or without punctuation', () => {
    expect(hasLegalSuffix('Ivydale Stores Inc.')).toBe(true);
    expect(hasLegalSuffix('Corbin School District LLC')).toBe(true);
    expect(hasLegalSuffix('Ivydale Stores')).toBe(false);
  });
});

describe('isAllCaps', () => {
  it('is true only for names written in capitals', () => {
    expect(isAllCaps('GRANVILLE INNS')).toBe(true);
    expect(isAllCaps('Granville Inns')).toBe(false);
    expect(isAllCaps('123')).toBe(false);
  });
});
