import { describe, expect, it } from 'vitest';
import { mentionsRiskWord } from '../../src/eval/keywords';

describe('mentionsRiskWord', () => {
  it('finds a word of the screen at the start of a word, in any case', () => {
    expect(mentionsRiskWord('Customer asked about early TERMINATION terms.')).toBe(true);
    expect(mentionsRiskWord('A competitor quoted 12% less.')).toBe(true);
  });

  it('ignores the same letters inside another word', () => {
    expect(mentionsRiskWord('Reviewed the translated report.')).toBe(false);
  });

  it('is false for a note with none of the words', () => {
    expect(mentionsRiskWord('Quarterly check-in. No open issues.')).toBe(false);
  });
});
