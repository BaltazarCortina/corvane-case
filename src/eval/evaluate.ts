// How well the LLM reads the account notes, three ways: against the hand labels, against the keyword
// screen as a baseline, and against billing, which no label or prompt can influence.

import type { BillingAnalysis } from '../billing/analyze';
import type { Model, Note } from '../model/model';
import { worstNoteByCustomer } from '../risk/noteRisk';
import type { NoteSignal } from '../risk/notes';
import { isAtRisk, RISK_LEVELS, type RiskLevel } from '../risk/scale';
import { mentionsRiskWord } from './keywords';
import type { Label } from './labels';
import { type Stratum, stratumOf } from './sample';
import { type AtRiskScore, type ReadingScore, scoreAtRisk, scoreReadings, type Weighted } from './score';

export interface Disagreement {
  noteId: string;
  text: string;
  group: Stratum;
  label: Label;
  llm: Pick<NoteSignal, 'risk' | 'reasons' | 'noteType' | 'quote' | 'summary'>;
}

/** Customers grouped by the highest risk their notes show over the last twelve months. */
export interface BillingCheckRow {
  notesSay: RiskLevel | 'no notes';
  customers: number;
  /** Median change of billing from the earlier half to the later one. */
  medianChangePct: number | null;
  /** Share of those customers billing less. */
  billingLess: number | null;
}

export interface EvaluationReport {
  model: string;
  promptVersion: string;
  evaluatedAt: string;
  groups: { group: Stratum; notes: number; labeled: number }[];
  llm: ReadingScore;
  keywordBaseline: AtRiskScore;
  /** Hand label against LLM, counted in the sample without weights. */
  confusion: { label: RiskLevel; llm: RiskLevel; notes: number }[];
  disagreements: Disagreement[];
  billingCheck: BillingCheckRow[];
}

export function evaluate(
  model: Model,
  billing: BillingAnalysis,
  signals: NoteSignal[],
  labels: Label[],
  evaluatedAt: string,
): EvaluationReport {
  const notes = new Map(model.notes.map((n) => [n.id, n]));
  const signalOf = new Map(signals.map((s) => [s.noteId, s]));
  const labeled = labels.map((label) => {
    const note = notes.get(label.noteId);
    const signal = signalOf.get(label.noteId);
    if (!note || !signal) throw new Error(`Labeled note ${label.noteId} has no note or no LLM reading`);
    return { label, note, signal };
  });

  const groups = groupSizes(model.notes, labeled);
  const weightOf = (note: Note) => {
    const group = groups.find((g) => g.group === stratumOf(note));
    return group ? group.notes / group.labeled : 0;
  };
  const readings = labeled.map(({ label, note, signal }) => ({
    weight: weightOf(note),
    item: { label, reading: signal },
  }));
  const keywordReadings: Weighted<{ labeled: boolean; flagged: boolean }>[] = labeled.map(({ label, note }) => {
    const atRisk = isAtRisk(label.risk);
    const flagged = mentionsRiskWord(note.text);
    return { weight: weightOf(note), item: { labeled: atRisk, flagged } };
  });

  const disagreements = labeled
    .filter(({ label, signal }) => label.risk !== signal.risk || label.noteType !== signal.noteType)
    .map(({ label, note, signal }) => ({
      noteId: note.id,
      text: note.text,
      group: stratumOf(note),
      label,
      llm: {
        risk: signal.risk,
        reasons: signal.reasons,
        noteType: signal.noteType,
        quote: signal.quote,
        summary: signal.summary,
      },
    }));

  return {
    model: signals[0]?.model ?? 'unknown',
    promptVersion: signals[0]?.promptVersion ?? 'unknown',
    evaluatedAt,
    groups,
    llm: scoreReadings(readings),
    keywordBaseline: scoreAtRisk(keywordReadings),
    confusion: confusionOf(labeled),
    disagreements,
    billingCheck: billingCheck(model, billing, signals),
  };
}

function groupSizes(notes: Note[], labeled: { note: Note }[]): EvaluationReport['groups'] {
  const strata: Stratum[] = ['keyword', 'other'];
  return strata.map((group) => {
    const inGroup = notes.filter((n) => stratumOf(n) === group).length;
    const labeledInGroup = labeled.filter(({ note }) => stratumOf(note) === group).length;
    return { group, notes: inGroup, labeled: labeledInGroup };
  });
}

function confusionOf(labeled: { label: Label; signal: NoteSignal }[]): EvaluationReport['confusion'] {
  const cells: EvaluationReport['confusion'] = [];
  for (const labelRisk of RISK_LEVELS) {
    for (const llmRisk of RISK_LEVELS) {
      const matching = labeled.filter(({ label, signal }) => label.risk === labelRisk && signal.risk === llmRisk);
      if (matching.length > 0) cells.push({ label: labelRisk, llm: llmRisk, notes: matching.length });
    }
  }
  return cells;
}

/**
 * Do the customers whose notes show risk bill less? Each customer is grouped by the highest risk in its
 * notes over the last twelve months, and its billing compared between the two halves of the bridge.
 */
function billingCheck(model: Model, billing: BillingAnalysis, signals: NoteSignal[]): BillingCheckRow[] {
  const period = billing.twelveMonths.window.current;
  const worstNotes = worstNoteByCustomer(model.notes, signals, period);
  const movers = billing.bridge.steps.flatMap((s) => s.movers).filter((m) => m.customerId !== null && m.previous > 0);
  const groups: BillingCheckRow['notesSay'][] = ['high', 'medium', 'low', 'none', 'no notes'];
  return groups.map((notesSay) => {
    const inGroup = movers.filter((m) => (worstNotes.get(m.customerId ?? '')?.risk ?? 'no notes') === notesSay);
    const changes = inGroup.map((m) => (m.change / m.previous) * 100);
    const billingLess = inGroup.filter((m) => m.change < 0).length;
    return {
      notesSay,
      customers: inGroup.length,
      medianChangePct: median(changes),
      billingLess: inGroup.length === 0 ? null : billingLess / inGroup.length,
    };
  });
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}
