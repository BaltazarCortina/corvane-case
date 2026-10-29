// The sample of account notes labeled by hand. A plain random sample would hold few notes with risk, too
// few to measure how many the LLM finds, so the notes are split by the keyword screen and a random
// sample is drawn from each group. Scores are weighted back by the size of each group. The draw uses a
// fixed seed, so it can be repeated; and it does not depend on the LLM, so the labels can be set before
// the LLM runs.

import type { Note } from '../pipeline/model';
import { mentionsRiskWord } from './keywords';

export const SAMPLE_SEED = 2026;
export const SAMPLE_SIZE_PER_GROUP = 20;

export type Stratum = 'keyword' | 'other';

export function stratumOf(note: Note): Stratum {
  return mentionsRiskWord(note.text) ? 'keyword' : 'other';
}

/** A random sample of each group, in date order. */
export function drawSample(notes: Note[], sizePerGroup = SAMPLE_SIZE_PER_GROUP, seed = SAMPLE_SEED): Note[] {
  const random = seededRandom(seed);
  const byId = [...notes].sort((a, b) => a.id.localeCompare(b.id));
  const keyword = byId.filter((n) => stratumOf(n) === 'keyword');
  const other = byId.filter((n) => stratumOf(n) === 'other');
  const keywordSample = randomSubset(keyword, sizePerGroup, random);
  const otherSample = randomSubset(other, sizePerGroup, random);
  const sample = [...keywordSample, ...otherSample];
  return sample.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
}

/** `size` items picked at random, without repetition (a partial Fisher–Yates shuffle). */
function randomSubset<T>(items: T[], size: number, random: () => number): T[] {
  const pool = [...items];
  const count = Math.min(size, pool.length);
  for (let i = 0; i < count; i++) {
    const j = i + Math.floor(random() * (pool.length - i));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, count);
}

/** A small seeded generator (mulberry32): the same seed always gives the same numbers. */
function seededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
