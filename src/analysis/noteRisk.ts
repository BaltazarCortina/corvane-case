// What the account notes say about each customer: the highest risk the LLM read in its notes over a
// period. Used by the evaluation to cross-check the notes with billing, and by the risk level.

import { higherRisk, type RiskLevel } from '../eval/scale';
import type { NoteSignal } from '../llm/notes';
import type { Note } from '../pipeline/model';
import { contains, type Period } from './calendar';

export function worstNoteRiskByCustomer(notes: Note[], signals: NoteSignal[], period: Period): Map<string, RiskLevel> {
  const signalOf = new Map(signals.map((s) => [s.noteId, s]));
  const worst = new Map<string, RiskLevel>();
  for (const note of notes) {
    const signal = signalOf.get(note.id);
    if (note.customerId === null || !signal || !contains(period, note.date)) continue;
    const current = worst.get(note.customerId) ?? 'none';
    worst.set(note.customerId, higherRisk(current, signal.risk));
  }
  return worst;
}
