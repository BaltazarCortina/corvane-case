import { describe, expect, it } from 'vitest';
import type { Note } from '../../src/model/model';
import { worstNoteByCustomer, worstNoteRiskByCustomer } from '../../src/risk/noteRisk';
import type { NoteSignal } from '../../src/risk/notes';

const note = (id: string, customerId: string | null, date: string): Note => ({
  id,
  line: 2,
  customerId,
  nameAsWritten: '',
  linkedBy: null,
  candidates: [],
  date,
  author: '',
  text: '',
});

const signal = (noteId: string, risk: NoteSignal['risk']): NoteSignal => ({
  noteId,
  risk,
  reasons: [],
  noteType: 'customer',
  quote: '',
  summary: '',
  quoteVerified: true,
  model: 'm',
  promptVersion: 'v',
});

const period = { label: '', start: '2025-10-01', end: '2026-09-30' };

describe('worstNoteByCustomer', () => {
  it('keeps the latest note when two have the same risk', () => {
    const notes = [
      note('N-1', 'C-1', '2026-03-01'),
      note('N-2', 'C-1', '2026-05-01'),
      note('N-3', 'C-1', '2026-04-01'),
    ];
    const signals = [signal('N-1', 'medium'), signal('N-2', 'medium'), signal('N-3', 'low')];
    const worst = worstNoteByCustomer(notes, signals, period);
    expect(worst.get('C-1')).toEqual({ noteId: 'N-2', date: '2026-05-01', risk: 'medium' });
  });
});

describe('worstNoteRiskByCustomer', () => {
  it('keeps the highest risk of each customer within the period', () => {
    const notes = [
      note('N-1', 'C-1', '2026-01-01'),
      note('N-2', 'C-1', '2026-02-01'),
      note('N-3', 'C-1', '2025-01-01'),
      note('N-4', 'C-2', '2026-03-01'),
      note('N-5', null, '2026-03-01'),
    ];
    const signals = [
      signal('N-1', 'medium'),
      signal('N-2', 'low'),
      signal('N-3', 'high'),
      signal('N-4', 'none'),
      signal('N-5', 'high'),
    ];
    const worst = worstNoteRiskByCustomer(notes, signals, period);
    expect([...worst]).toEqual([
      ['C-1', 'medium'],
      ['C-2', 'none'],
    ]);
  });
});
