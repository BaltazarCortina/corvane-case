import { describe, expect, it } from 'vitest';
import type { Note } from '../../src/model/model';
import { checkQuote, notePrompt, tidyAnswer } from '../../src/risk/notes';

const text = 'Customer asked about early termination terms. Said Bulwark quoted 12% less.';

describe('checkQuote', () => {
  it('accepts a quote that appears in the note', () => {
    expect(checkQuote({ risk: 'high', quote: 'asked about early termination terms' }, text)).toBe(true);
  });

  it('ignores case, spacing, typographic quotes and quotation marks around the quote', () => {
    expect(checkQuote({ risk: 'high', quote: '"Asked about  early termination"' }, text)).toBe(true);
    expect(checkQuote({ risk: 'medium', quote: 'Said Bulwark quoted 12% less.' }, text)).toBe(true);
  });

  it('rejects a paraphrase or a missing quote when there is risk', () => {
    expect(checkQuote({ risk: 'high', quote: 'wants to terminate early' }, text)).toBe(false);
    expect(checkQuote({ risk: 'medium', quote: '' }, text)).toBe(false);
  });

  it('needs no quote when there is no risk', () => {
    expect(checkQuote({ risk: 'none', quote: '' }, text)).toBe(true);
  });
});

describe('tidyAnswer', () => {
  const answer = { risk: 'high' as const, reasons: [], noteType: 'customer' as const, quote: '', summary: '' };

  it('keeps each reason once', () => {
    const tidy = tidyAnswer({ ...answer, reasons: ['competitor', 'price', 'competitor'] });
    expect(tidy.reasons).toEqual(['competitor', 'price']);
  });

  it('drops reasons when there is no risk', () => {
    const tidy = tidyAnswer({ ...answer, risk: 'none', reasons: ['service'] });
    expect(tidy.reasons).toEqual([]);
  });
});

describe('notePrompt', () => {
  it('sends the note as written, without the customer it was linked to', () => {
    const note: Note = {
      id: 'N-1',
      line: 2,
      customerId: 'C-1',
      nameAsWritten: 'kessler surgical',
      linkedBy: 'shortened',
      candidates: [],
      date: '2026-01-05',
      author: 'D. Hargrove',
      text,
    };
    expect(notePrompt(note)).toBe(`Account: kessler surgical\nDate: 2026-01-05\nAuthor: D. Hargrove\nNote: ${text}`);
  });
});
