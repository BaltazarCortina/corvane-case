// What the account notes say about each customer: the highest risk the LLM read in its notes over a
// period. Used by the evaluation to cross-check the notes with billing, and by the risk level.

import { RISK_LEVELS, type RiskLevel } from '../eval/scale';
import type { NoteSignal } from '../llm/notes';
import type { Note } from '../pipeline/model';
import { contains, type Period } from './calendar';

/** The note with the highest risk; between notes at the same level, the latest. */
export interface WorstNote {
  noteId: string;
  date: string;
  risk: RiskLevel;
}

export function worstNoteByCustomer(notes: Note[], signals: NoteSignal[], period: Period): Map<string, WorstNote> {
  const signalOf = new Map(signals.map((s) => [s.noteId, s]));
  const worst = new Map<string, WorstNote>();
  for (const note of notes) {
    const signal = signalOf.get(note.id);
    if (note.customerId === null || !signal || !contains(period, note.date)) continue;
    const current = worst.get(note.customerId);
    const candidate = { noteId: note.id, date: note.date, risk: signal.risk };
    if (!current || isWorse(candidate, current)) worst.set(note.customerId, candidate);
  }
  return worst;
}

function isWorse(a: WorstNote, b: WorstNote): boolean {
  const rankA = RISK_LEVELS.indexOf(a.risk);
  const rankB = RISK_LEVELS.indexOf(b.risk);
  return rankA > rankB || (rankA === rankB && a.date > b.date);
}

export function worstNoteRiskByCustomer(notes: Note[], signals: NoteSignal[], period: Period): Map<string, RiskLevel> {
  const worst = worstNoteByCustomer(notes, signals, period);
  const entries = [...worst].map(([customerId, note]) => [customerId, note.risk] as const);
  return new Map(entries);
}
