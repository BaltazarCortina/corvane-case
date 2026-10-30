import { describe, expect, it } from 'vitest';
import type { Fact } from '../../src/llm/facts';
import { datesIn, numbersIn, type StoryClaims, verifyStory } from '../../src/llm/verify';
import type { Note } from '../../src/pipeline/model';

const facts: Fact[] = [
  { id: 'F1', text: 'Billing without atypical invoices, H1 FY26 $61k, H1 FY27 $34k (−43.9%).' },
  { id: 'F2', text: 'Contract CTR-1: $109k a year, from 2024-06-01; ended on 2026-05-31.' },
  { id: 'F3', text: 'Monthly billing without atypical invoices: Apr 2026 $6k, May 2026 $6k.' },
];

const note = (id: string, date: string, text: string): Note => ({
  id,
  line: 2,
  customerId: 'C-1',
  nameAsWritten: '',
  linkedBy: 'exact',
  candidates: [],
  date,
  author: '',
  text,
});

const notes = [
  note('N-1', '2026-01-25', 'Escalated the backlog to their VP. Wants service credits of $4,200.'),
  note('N-2', '2026-05-16', 'Getting quotes from another company for next year.'),
];

const story = (overrides: Partial<StoryClaims> = {}): StoryClaims => ({
  headline: 'Billing fell 43.9% as a competitor quotes',
  rootCause: { text: 'Late reports led to an escalation on 2026-01-25 and a $4,200 credit demand.', cites: ['N-1'] },
  currentState: {
    text: 'Billing fell from $61k to $34k (43.9%); the contract ended in May 2026.',
    cites: ['F1', 'F2'],
  },
  nextStep: {
    text: 'Meet the customer before it signs with the competitor it got quotes from in May 2026.',
    cites: ['N-2'],
  },
  ...overrides,
});

describe('verifyStory', () => {
  it('passes a story whose citations exist and whose numbers and dates are in what it cites', () => {
    const check = verifyStory(story(), facts, notes);
    expect(check.problems).toEqual([]);
    expect(check.ok).toBe(true);
    expect(check.checked).toEqual({ citations: 4, numbers: 5, dates: 3 });
  });

  it('flags a claim that cites nothing, or an id that was not in the input', () => {
    const check = verifyStory(
      story({
        rootCause: { text: 'Not recorded in the notes.', cites: [] },
        nextStep: { text: 'Call the customer.', cites: ['F9', 'N-1'] },
      }),
      facts,
      notes,
    );
    expect(check.ok).toBe(false);
    expect(check.problems).toEqual([
      'The root cause cites nothing.',
      'The next step cites F9, which was not in the input.',
    ]);
  });

  it('flags a number that is not in what the claim cites, and says where it is if anywhere', () => {
    const check = verifyStory(
      story({ currentState: { text: 'Billing fell 44% to $34k.', cites: ['N-2'] } }),
      facts,
      notes,
    );
    expect(check.problems).toEqual([
      'The current state gives $34k, which is not in what it cites (it is in F1).',
      'The current state gives 44%, which is in no fact or note.',
    ]);
  });

  it('flags a date that matches nothing the claim cites', () => {
    const check = verifyStory(
      story({ rootCause: { text: 'The customer escalated on 2026-01-26, in Feb 2026.', cites: ['N-1'] } }),
      facts,
      notes,
    );
    expect(check.problems).toEqual([
      'The root cause gives the date 2026-01-26, which is in no fact or note.',
      'The root cause gives the date 2026-02, which is in no fact or note.',
    ]);
  });

  it('checks the headline against the whole input, and keeps ids out of it', () => {
    const check = verifyStory(story({ headline: 'Down 50% since N-1' }), facts, notes);
    expect(check.problems).toEqual([
      'The headline names N-1; ids belong in the citations.',
      'The headline gives 50%, which is in no fact or note.',
    ]);
  });
});

describe('numbersIn', () => {
  it('reads amounts and percentages without sign, spacing or separators', () => {
    expect(numbersIn('From $4,200 to −$1.1M, down −43.9% or 12%. $27K.')).toEqual([
      '$4200',
      '$1.1M',
      '$27k',
      '43.9%',
      '12%',
    ]);
  });
});

describe('datesIn', () => {
  it('reads ISO dates, written days and months', () => {
    expect(datesIn('On 2026-01-25, then May 16, 2026, and in September 2025.')).toEqual([
      '2026-01-25',
      '2026-05-16',
      '2025-09',
    ]);
  });
});
