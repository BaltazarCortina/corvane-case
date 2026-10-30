// Mechanical checks on a customer story. Every claim must cite facts or notes that were in the input,
// and every amount, percentage and date it gives must be found in what it cites. A check that fails is
// reported next to the story, never hidden: the story is shown with its problems.

import type { Note } from '../model/model';
import type { Fact } from './facts';

export interface Claim {
  text: string;
  /** Ids of the facts (F1, F2...) and notes (N-...) the text relies on. */
  cites: string[];
}

export interface StoryClaims {
  headline: string;
  rootCause: Claim;
  currentState: Claim;
  nextStep: Claim;
}

export interface StoryCheck {
  ok: boolean;
  problems: string[];
  /** How many of each were checked, problems or not. */
  checked: { citations: number; numbers: number; dates: number };
}

const CLAIMS = [
  ['root cause', 'rootCause'],
  ['current state', 'currentState'],
  ['next step', 'nextStep'],
] as const;

export function verifyStory(story: StoryClaims, facts: Fact[], notes: Note[]): StoryCheck {
  const sources = new Map<string, Source>();
  for (const fact of facts) sources.set(fact.id, { text: fact.text, dates: [] });
  for (const note of notes) sources.set(note.id, { text: note.text, dates: [note.date] });
  const everything = [...sources.values()];

  const problems: string[] = [];
  const checked = { citations: 0, numbers: 0, dates: 0 };
  for (const [label, key] of CLAIMS) {
    const claim = story[key];
    const unknown = claim.cites.filter((id) => !sources.has(id));
    const cited = claim.cites.filter((id) => sources.has(id)).map((id) => sources.get(id) as Source);
    checked.citations += claim.cites.length;
    if (claim.cites.length === 0) problems.push(`The ${label} cites nothing.`);
    for (const id of unknown) problems.push(`The ${label} cites ${id}, which was not in the input.`);
    for (const number of numbersIn(claim.text)) {
      checked.numbers += 1;
      if (!cited.some((s) => hasNumber(s, number)))
        problems.push(`The ${label} gives ${number}, ${notFound(number, sources, hasNumber)}.`);
    }
    for (const date of datesIn(claim.text)) {
      checked.dates += 1;
      if (!cited.some((s) => hasDate(s, date)))
        problems.push(`The ${label} gives the date ${date}, ${notFound(date, sources, hasDate)}.`);
    }
  }

  // The headline cites nothing, so what it says is checked against the whole input.
  for (const id of idsIn(story.headline)) problems.push(`The headline names ${id}; ids belong in the citations.`);
  for (const number of numbersIn(story.headline)) {
    checked.numbers += 1;
    if (!everything.some((s) => hasNumber(s, number)))
      problems.push(`The headline gives ${number}, which is in no fact or note.`);
  }
  for (const date of datesIn(story.headline)) {
    checked.dates += 1;
    if (!everything.some((s) => hasDate(s, date)))
      problems.push(`The headline gives the date ${date}, which is in no fact or note.`);
  }
  return { ok: problems.length === 0, problems, checked };
}

interface Source {
  text: string;
  /** The date a note was written; facts carry their dates in the text. */
  dates: string[];
}

/** Says whether the value is somewhere else in the input, so the fix is to cite it, or nowhere. */
function notFound(value: string, sources: Map<string, Source>, has: (s: Source, v: string) => boolean): string {
  const elsewhere = [...sources].filter(([, s]) => has(s, value)).map(([id]) => id);
  if (elsewhere.length === 0) return 'which is in no fact or note';
  return `which is not in what it cites (it is in ${elsewhere.slice(0, 3).join(', ')})`;
}

const MONEY = /\$\s?\d[\d,]*(?:\.\d+)?\s?[kKmM]?\b/g;
const PERCENT = /\d+(?:\.\d+)?%/g;

/** Dollar amounts and percentages, without sign, spacing or thousands separators: `$27k`, `43.9%`. */
export function numbersIn(text: string): string[] {
  const money = text.match(MONEY) ?? [];
  const percents = text.match(PERCENT) ?? [];
  const numbers = [...money, ...percents].map(normalizeNumber);
  return [...new Set(numbers)];
}

function normalizeNumber(number: string): string {
  return number.replace(/[\s,]/g, '').replace(/[kK]$/, 'k').replace(/[mM]$/, 'M');
}

function hasNumber(source: Source, number: string): boolean {
  const numbers = numbersIn(source.text);
  return numbers.includes(number);
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const ISO_DATE = /\b\d{4}-\d{2}-\d{2}\b/g;
const WRITTEN_DATE = /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.? (?:(\d{1,2}), )?(\d{4})\b/g;

/** Dates as `YYYY-MM-DD`, and months written out as `YYYY-MM`: "May 16, 2026" and "May 2026". */
export function datesIn(text: string): string[] {
  const iso = text.match(ISO_DATE) ?? [];
  const written = [...text.matchAll(WRITTEN_DATE)].map(([, month, day, year]) => {
    const monthNumber = String(MONTHS.indexOf(month.toLowerCase()) + 1).padStart(2, '0');
    return day ? `${year}-${monthNumber}-${day.padStart(2, '0')}` : `${year}-${monthNumber}`;
  });
  return [...new Set([...iso, ...written])];
}

/** A day must be the note's date or written in the source; a month, hold one of those dates or be named. */
function hasDate(source: Source, date: string): boolean {
  const datesInText = datesIn(source.text);
  const dates = [...source.dates, ...datesInText];
  if (date.length === 10) return dates.includes(date);
  return dates.some((d) => d.startsWith(date));
}

function idsIn(text: string): string[] {
  return text.match(/\b(?:F\d+|N-\d+)\b/g) ?? [];
}
