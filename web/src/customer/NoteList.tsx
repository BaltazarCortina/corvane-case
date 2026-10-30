// The customer's notes, newest first, each with the risk the AI read in it and the words that justify it
// marked in the text.

import type { Note } from '../../../src/model/model';
import type { NoteSignal } from '../../../src/risk/notes';
import { dayLabel } from '../../../src/shared/calendar';
import { RiskBadge } from '../components/RiskBadge';
import { REASON_LABELS } from '../worklist/labels';

export function NoteList({
  notes,
  signals,
  numbers,
}: {
  notes: Note[];
  signals: NoteSignal[];
  /** Each note's number, the one the story cites it by. */
  numbers: Map<string, number>;
}) {
  const signalOf = new Map(signals.map((s) => [s.noteId, s]));
  const newestFirst = [...notes].sort((a, b) => b.date.localeCompare(a.date));
  return (
    <section>
      <h3 className="mb-2 font-semibold">
        Notes <span className="font-normal text-ink-muted text-sm">{notes.length}</span>
      </h3>
      {notes.length === 0 && <p className="text-ink-muted text-sm">No account notes.</p>}
      <ol className="space-y-2">
        {newestFirst.map((note) => {
          const signal = signalOf.get(note.id);
          return (
            <li
              key={note.id}
              id={`note-${note.id}`}
              className="rounded-lg border border-hairline p-3 text-sm transition-shadow"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="flex items-center gap-2 text-ink-muted">
                  <span className="inline-flex size-5 items-center justify-center rounded-full bg-hairline font-medium text-[10px] text-ink-secondary">
                    {numbers.get(note.id)}
                  </span>
                  {dayLabel(note.date)} · {note.author}
                </span>
                {signal && signal.risk !== 'none' && (
                  <span className="flex items-center gap-2">
                    <RiskBadge level={signal.risk} />
                    <span className="text-ink-muted">
                      {signal.reasons.map((r) => REASON_LABELS[r].toLowerCase()).join(', ')}
                    </span>
                  </span>
                )}
              </div>
              <p className="mt-1.5 leading-relaxed">
                <Marked text={note.text} quote={signal?.quote ?? ''} />
              </p>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/** The note with the quote that justifies its risk marked, when it is found as written. */
function Marked({ text, quote }: { text: string; quote: string }) {
  const at = quote ? text.toLowerCase().indexOf(quote.toLowerCase()) : -1;
  if (at < 0) return <>{text}</>;
  const end = at + quote.length;
  return (
    <>
      {text.slice(0, at)}
      <mark className="rounded bg-risk-medium/20 px-0.5 text-ink">{text.slice(at, end)}</mark>
      {text.slice(end)}
    </>
  );
}
