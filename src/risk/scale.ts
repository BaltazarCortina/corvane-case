// The scale an account note is judged on, the same for a person labeling it and for the LLM.

export const RISK_LEVELS = ['none', 'low', 'medium', 'high'] as const;
export const REASONS = ['service', 'price', 'competitor', 'billing', 'other'] as const;
export const NOTE_TYPES = ['customer', 'internal', 'prospect'] as const;

export type RiskLevel = (typeof RISK_LEVELS)[number];
export type Reason = (typeof REASONS)[number];
export type NoteType = (typeof NOTE_TYPES)[number];

/** A note puts the customer at risk when its level is medium or high. */
export function isAtRisk(risk: RiskLevel): boolean {
  return risk === 'medium' || risk === 'high';
}
