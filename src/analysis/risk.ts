// How likely Corvane is to lose a customer, from two signals read apart: the worst account note of the
// last twelve months, as the LLM read it, and the decline in billing. A matrix combines them, with no
// points to add up, so every level can be explained in one line.

import type { RiskLevel } from '../eval/scale';
import type { Parameters } from '../pipeline/assumptions';
import { sumMoney } from '../pipeline/money';
import { percent, usd } from './format';
import type { WorstNote } from './noteRisk';

export const DECLINE_LEVELS = ['none', 'moderate', 'strong', 'veryStrong'] as const;

export type DeclineLevel = (typeof DECLINE_LEVELS)[number];

export interface Decline {
  level: DeclineLevel;
  previous: number;
  current: number;
  /** Null when there was no billing to compare with. */
  changePct: number | null;
}

export interface Risk {
  level: RiskLevel;
  reason: string;
  /** Null when the customer has no note in the last twelve months. */
  worstNote: WorstNote | null;
  decline: Decline;
}

/**
 * Worst note down, decline across. A high note is high risk on its own, and so is a very strong decline:
 * the account manager may not have written down what matters. A strong decline with no note behind it
 * is a signal, not a certainty, so it stops at medium.
 */
const MATRIX: Record<RiskLevel, Record<DeclineLevel, RiskLevel>> = {
  none: { none: 'none', moderate: 'low', strong: 'medium', veryStrong: 'high' },
  low: { none: 'low', moderate: 'low', strong: 'medium', veryStrong: 'high' },
  medium: { none: 'medium', moderate: 'medium', strong: 'high', veryStrong: 'high' },
  high: { none: 'high', moderate: 'high', strong: 'high', veryStrong: 'high' },
};

export function riskLevel(noteRisk: RiskLevel, decline: DeclineLevel): RiskLevel {
  return MATRIX[noteRisk][decline];
}

/**
 * How much less the customer billed. Below the minimum amount it is no decline whatever the share, so a
 * small customer's swing does not count.
 */
export function declineOf(previous: number, current: number, parameters: Parameters): Decline {
  const drop = sumMoney([previous, -current]);
  const changePct = previous === 0 ? null : (-drop / previous) * 100;
  const share = previous === 0 ? 0 : drop / previous;
  return { level: declineLevel(drop, share, parameters), previous, current, changePct };
}

function declineLevel(drop: number, share: number, parameters: Parameters): DeclineLevel {
  if (drop < parameters.minimumDeclineAmount) return 'none';
  if (share >= parameters.veryStrongDeclineShare) return 'veryStrong';
  if (share >= parameters.strongDeclineShare) return 'strong';
  if (share >= parameters.moderateDeclineShare) return 'moderate';
  return 'none';
}

export function riskOf(worstNote: WorstNote | null, decline: Decline): Risk {
  const noteRisk = worstNote?.risk ?? 'none';
  const level = riskLevel(noteRisk, decline.level);
  return { level, reason: reasonOf(worstNote, decline), worstNote, decline };
}

/** The signals behind the level, in one line: "High note on 2026-09-07 and billing down 26.0% ($41k)". */
function reasonOf(worstNote: WorstNote | null, decline: Decline): string {
  const signals: string[] = [];
  if (worstNote && worstNote.risk !== 'none') {
    const level = worstNote.risk[0].toUpperCase() + worstNote.risk.slice(1);
    signals.push(`${level} note on ${worstNote.date}`);
  }
  if (decline.level !== 'none') {
    const drop = sumMoney([decline.previous, -decline.current]);
    const down = percent(decline.changePct).replace('−', '');
    signals.push(`billing down ${down} (${usd(drop)})`);
  }
  if (signals.length === 0) return 'No risk in the notes or in billing';
  const sentence = signals.join(' and ');
  return sentence[0].toUpperCase() + sentence.slice(1);
}
