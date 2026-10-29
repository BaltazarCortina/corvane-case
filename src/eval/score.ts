// Scores against the hand labels. Every labeled note carries a weight: how many notes of its group it
// stands for (the size of the group over the notes drawn from it). Weighted counts estimate what each
// score would be over all the notes, not just over the sample.

import type { Label } from './labels';
import { isAtRisk } from './scale';

export interface Weighted<T> {
  weight: number;
  item: T;
}

/** Finding notes at risk: how many it flags are right, and how many of those at risk it finds. */
export interface AtRiskScore {
  /** Of the notes flagged at risk, the share that is at risk. */
  precision: number | null;
  /** Of the notes at risk, the share that is flagged. */
  recall: number | null;
  /** The plain counts in the sample, before weighting. */
  counts: { truePositive: number; falsePositive: number; falseNegative: number; trueNegative: number };
}

export function scoreAtRisk(items: Weighted<{ labeled: boolean; flagged: boolean }>[]): AtRiskScore {
  const weightOf = (labeled: boolean, flagged: boolean) => {
    const matching = items.filter((i) => i.item.labeled === labeled && i.item.flagged === flagged);
    const weights = matching.map((i) => i.weight);
    return { weight: sum(weights), count: matching.length };
  };
  const truePositive = weightOf(true, true);
  const falsePositive = weightOf(false, true);
  const falseNegative = weightOf(true, false);
  const trueNegative = weightOf(false, false);
  return {
    precision: ratio(truePositive.weight, truePositive.weight + falsePositive.weight),
    recall: ratio(truePositive.weight, truePositive.weight + falseNegative.weight),
    counts: {
      truePositive: truePositive.count,
      falsePositive: falsePositive.count,
      falseNegative: falseNegative.count,
      trueNegative: trueNegative.count,
    },
  };
}

/** What a classifier says about one note, on the same scale as the labels. */
export type Reading = Pick<Label, 'risk' | 'reasons' | 'noteType'>;

export interface ReadingScore {
  atRisk: AtRiskScore;
  /** Share of notes given the same risk level. */
  sameRisk: number | null;
  /** Share of notes given the same note type. */
  sameNoteType: number | null;
  /** Over notes both call at risk: share of labeled reasons found, and share of given reasons labeled. */
  reasons: { recall: number | null; precision: number | null };
}

export function scoreReadings(items: Weighted<{ label: Label; reading: Reading }>[]): ReadingScore {
  const atRiskItems = items.map(({ weight, item }) => {
    const labeled = isAtRisk(item.label.risk);
    const flagged = isAtRisk(item.reading.risk);
    return { weight, item: { labeled, flagged } };
  });
  const weights = items.map((i) => i.weight);
  const totalWeight = sum(weights);
  const sameRisk = items.filter((i) => i.item.label.risk === i.item.reading.risk).map((i) => i.weight);
  const sameType = items.filter((i) => i.item.label.noteType === i.item.reading.noteType).map((i) => i.weight);
  const sameRiskWeight = sum(sameRisk);
  const sameTypeWeight = sum(sameType);
  return {
    atRisk: scoreAtRisk(atRiskItems),
    sameRisk: ratio(sameRiskWeight, totalWeight),
    sameNoteType: ratio(sameTypeWeight, totalWeight),
    reasons: scoreReasons(items),
  };
}

function scoreReasons(items: Weighted<{ label: Label; reading: Reading }>[]): ReadingScore['reasons'] {
  let labeled = 0;
  let given = 0;
  let agreed = 0;
  for (const { weight, item } of items) {
    if (!isAtRisk(item.label.risk) || !isAtRisk(item.reading.risk)) continue;
    const shared = item.reading.reasons.filter((r) => item.label.reasons.includes(r));
    labeled += weight * item.label.reasons.length;
    given += weight * item.reading.reasons.length;
    agreed += weight * shared.length;
  }
  return { recall: ratio(agreed, labeled), precision: ratio(agreed, given) };
}

const sum = (values: number[]) => values.reduce((total, v) => total + v, 0);

const ratio = (part: number, whole: number) => (whole === 0 ? null : part / whole);
