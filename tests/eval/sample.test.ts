import { describe, expect, it } from 'vitest';
import { drawSample, stratumOf } from '../../src/eval/sample';
import type { Note } from '../../src/model/model';

const note = (n: number, text: string): Note => ({
  id: `N-${String(n).padStart(3, '0')}`,
  line: n + 1,
  customerId: null,
  nameAsWritten: 'Acme',
  linkedBy: null,
  candidates: [],
  date: `2025-01-${String((n % 28) + 1).padStart(2, '0')}`,
  author: 'A',
  text,
});

const keywordNotes = Array.from({ length: 30 }, (_, i) => note(i, 'They asked to cancel.'));
const otherNotes = Array.from({ length: 50 }, (_, i) => note(100 + i, 'Routine visit.'));
const notes = [...otherNotes, ...keywordNotes];

describe('drawSample', () => {
  it('draws the same number of notes from each group', () => {
    const sample = drawSample(notes, 5);
    const groups = sample.map(stratumOf);
    expect(groups.filter((g) => g === 'keyword')).toHaveLength(5);
    expect(groups.filter((g) => g === 'other')).toHaveLength(5);
  });

  it('draws the same sample every time with the same seed, whatever the order of the notes', () => {
    const shuffled = [...notes].reverse();
    const first = drawSample(notes, 5, 7).map((n) => n.id);
    const second = drawSample(shuffled, 5, 7).map((n) => n.id);
    expect(second).toEqual(first);
  });

  it('draws another sample with another seed', () => {
    const first = drawSample(notes, 5, 7).map((n) => n.id);
    const second = drawSample(notes, 5, 8).map((n) => n.id);
    expect(second).not.toEqual(first);
  });

  it('takes the whole group when it is smaller than the sample size', () => {
    const few = [...otherNotes, ...keywordNotes.slice(0, 3)];
    const sample = drawSample(few, 5);
    expect(sample.filter((n) => stratumOf(n) === 'keyword')).toHaveLength(3);
  });

  it('orders the sample by date', () => {
    const dates = drawSample(notes, 5).map((n) => n.date);
    expect(dates).toEqual([...dates].sort());
  });
});
