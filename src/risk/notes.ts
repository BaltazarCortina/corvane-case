// Reads one account note at a time and says what it tells about the risk of losing the customer. One
// note per call, without the customer's other notes or numbers, so every answer can be checked against
// the note it came from. Putting the notes together is the job of the customer story.

import { generateText, Output } from 'ai';
import { z } from 'zod';
import { cached } from '../llm/cache';
import type { Llm } from '../llm/provider';
import type { Note } from '../model/model';
import { NOTE_TYPES, REASONS, RISK_LEVELS } from './scale';

/** Changing the instructions or the schema changes this, so cached answers are not reused. */
export const NOTE_PROMPT_VERSION = 'notes-1';

const answerSchema = z.object({
  risk: z.enum(RISK_LEVELS),
  reasons: z.array(z.enum(REASONS)),
  noteType: z.enum(NOTE_TYPES),
  quote: z.string(),
  summary: z.string(),
});

type Answer = z.infer<typeof answerSchema>;

export interface NoteSignal extends Answer {
  noteId: string;
  /** The quote appears in the note as written (or there is no risk to justify). */
  quoteVerified: boolean;
  model: string;
  promptVersion: string;
}

const INSTRUCTIONS = `You read one note an account manager wrote about a customer of Corvane Fire & Safety Services, a commercial fire protection company: inspections, testing, monitoring and repair of sprinkler and alarm systems. Say what the note tells about the risk of losing this customer, or part of its business. Judge what the note means, not the words it uses.

risk, defined by principle:
- high: the customer has decided, or is acting, to end or reduce the relationship (it said so, sent a notice, moved work to someone else, asked how to get out of the contract), or the conflict went beyond the account manager (a formal complaint, a lawyer, a regulator).
- medium: a concrete problem, or pressure from a competitor, that can lead to the above if nobody acts.
- low: minor friction, or a problem already resolved in the note.
- none: routine work, or something positive.
For example, a missed inspection is medium; a customer asking for termination terms is high; a late report that was sent the same day with the customer satisfied is low. These are examples, not a closed list.

reasons, one or more, only when risk is not none:
- service: work not done, done late or done badly, including late reports.
- price: pushback on price or on a price increase.
- competitor: another company is quoting, bidding or already doing the work.
- billing: wrong, duplicated or disputed invoices.
- other: anything else.

noteType:
- customer: about this customer's account.
- internal: about Corvane itself, such as staffing at a branch, even if it affects the customer.
- prospect: the company is not a customer yet.

quote: the shortest part of the note that justifies the risk, copied exactly as written, character by character. Empty when risk is none.

summary: one short sentence in plain English that a CFO can read.`;

export function notePrompt(note: Note): string {
  return [`Account: ${note.nameAsWritten}`, `Date: ${note.date}`, `Author: ${note.author}`, `Note: ${note.text}`].join(
    '\n',
  );
}

export async function classifyNote(note: Note, llm: Llm, cacheDir: string): Promise<NoteSignal> {
  const prompt = notePrompt(note);
  const key = { version: NOTE_PROMPT_VERSION, model: llm.modelId, prompt };
  const answer = await cached(cacheDir, key, async () => {
    const output = Output.object({ schema: answerSchema });
    const result = await generateText({ model: llm.model, instructions: INSTRUCTIONS, prompt, output });
    return result.output;
  });
  const tidy = tidyAnswer(answer);
  const quoteVerified = checkQuote(tidy, note.text);
  return { noteId: note.id, ...tidy, quoteVerified, model: llm.modelId, promptVersion: NOTE_PROMPT_VERSION };
}

/** No reasons without risk, and each reason once. */
export function tidyAnswer(answer: Answer): Answer {
  const reasons = answer.risk === 'none' ? [] : [...new Set(answer.reasons)];
  return { ...answer, reasons };
}

/**
 * A risk must be justified by a quote that appears in the note. Spacing, typographic quotes, the case of
 * letters and quotation marks around the whole quote are ignored; nothing else is.
 */
export function checkQuote(answer: Pick<Answer, 'risk' | 'quote'>, text: string): boolean {
  if (answer.risk === 'none') return true;
  const quote = normalize(answer.quote).replace(/^["']|["']$/g, '');
  if (!quote) return false;
  return normalize(text).includes(quote);
}

function normalize(text: string): string {
  const straightQuotes = text.replace(/[‘’]/g, "'").replace(/[“”]/g, '"');
  return straightQuotes.replace(/\s+/g, ' ').trim().toLowerCase();
}
