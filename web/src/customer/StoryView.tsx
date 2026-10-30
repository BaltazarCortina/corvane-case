// The customer's story, with its sources as references after each claim, like footnotes: a note by its
// number in the list of notes, a fact by its letter in the data the story was written from, listed under
// it. The result of the verifier comes with it.

import { type ReactNode, useState } from 'react';
import type { Note } from '../../../src/model/model';
import { dayLabel } from '../../../src/shared/calendar';
import type { CustomerStory } from '../../../src/stories/stories';
import type { Claim } from '../../../src/stories/verify';

const TRAJECTORY_LABELS: Record<CustomerStory['trajectory'], string> = {
  lost: 'Lost',
  worsening: 'Worsening',
  stable: 'Stable',
  improving: 'Improving',
};

export function StoryView({
  story,
  notes,
  numbers,
}: {
  story: CustomerStory;
  notes: Note[];
  /** Each note's number in the list of notes. */
  numbers: Map<string, number>;
}) {
  const [factsOpen, setFactsOpen] = useState(false);
  const claims: [string, Claim][] = [
    ['Root cause', story.rootCause],
    ['Where it stands', story.currentState],
    ['Suggested next step', story.nextStep],
  ];
  const letters = factLetters(story);
  const showFact = (factId: string) => {
    setFactsOpen(true);
    // Once the list is open, the fact is on the page to scroll to.
    setTimeout(() => mark(`fact-${factId}`), 50);
  };
  return (
    <section>
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="font-semibold">Story</h3>
        <span className="text-ink-muted text-xs">Written by AI from the notes and the data</span>
      </div>
      <div className="mt-3 rounded-xl border border-hairline bg-page/60 p-5">
        <p className="font-medium text-lg leading-snug">{story.headline}</p>
        <p className="mt-1 text-ink-muted text-xs">Trajectory: {TRAJECTORY_LABELS[story.trajectory]}</p>
        <dl className="mt-4 space-y-4 text-sm">
          {claims.map(([label, claim]) => (
            <div key={label}>
              <dt className="font-medium text-ink-secondary text-xs uppercase tracking-wide">{label}</dt>
              <dd className="mt-1 leading-relaxed">
                {claim.text}
                <Citations
                  claim={claim}
                  story={story}
                  notes={notes}
                  numbers={numbers}
                  letters={letters}
                  onFact={showFact}
                />
              </dd>
            </div>
          ))}
        </dl>
        <Facts story={story} letters={letters} open={factsOpen} onToggle={() => setFactsOpen(!factsOpen)} />
        <Check story={story} />
      </div>
    </section>
  );
}

/** Letters for the facts, in the order the story got them: a, b, c... */
function factLetters(story: CustomerStory): Map<string, string> {
  const entries = story.facts.map((f, i): [string, string] => [f.id, String.fromCharCode(97 + i)]);
  return new Map(entries);
}

/**
 * The sources of a claim as small references after it, like footnotes: each note by its number in the list
 * of notes, each fact by its letter in the data below. Hovering shows the source; a click takes you to it.
 */
function Citations({
  claim,
  story,
  notes,
  numbers,
  letters,
  onFact,
}: {
  claim: Claim;
  story: CustomerStory;
  notes: Note[];
  numbers: Map<string, number>;
  letters: Map<string, string>;
  onFact: (factId: string) => void;
}) {
  const cited = notes.filter((n) => claim.cites.includes(n.id));
  const byNumber = cited.sort((a, b) => (numbers.get(a.id) ?? 0) - (numbers.get(b.id) ?? 0));
  const facts = story.facts.filter((f) => claim.cites.includes(f.id));
  return (
    <span className="whitespace-nowrap">
      {byNumber.map((n) => (
        <Ref key={n.id} label={String(numbers.get(n.id))} onSelect={() => mark(`note-${n.id}`)}>
          <span className="block text-ink-muted">
            {dayLabel(n.date)} · {n.author}
          </span>
          <span className="mt-1 block text-ink">{n.text}</span>
        </Ref>
      ))}
      {facts.map((f) => (
        <Ref key={f.id} label={letters.get(f.id) ?? ''} onSelect={() => onFact(f.id)}>
          <span className="block text-ink-muted">Data</span>
          <span className="mt-1 block text-ink">{f.text}</span>
        </Ref>
      ))}
    </span>
  );
}

/** The facts the story was written from, each with the letter it is cited by; closed until asked for. */
function Facts({
  story,
  letters,
  open,
  onToggle,
}: {
  story: CustomerStory;
  letters: Map<string, string>;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="mt-4 border-hairline border-t pt-3">
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        className="text-ink-secondary text-xs hover:text-ink"
      >
        {open ? '▾' : '▸'} Data the story was written from ({story.facts.length})
      </button>
      {open && (
        <ol className="mt-2 space-y-1.5 text-xs">
          {story.facts.map((f) => (
            <li key={f.id} id={`fact-${f.id}`} className="flex gap-2 rounded px-1 py-0.5 transition-shadow">
              <span className="w-3 shrink-0 font-medium text-series-1">{letters.get(f.id)}</span>
              <span className="text-ink-secondary">{f.text}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

/** One reference: a small raised label that shows its source on hover or focus. */
function Ref({ label, onSelect, children }: { label: string; onSelect?: () => void; children: ReactNode }) {
  const [opensLeft, setOpensLeft] = useState(false);
  // The source opens toward the side of the panel with room for it.
  const place = (target: HTMLElement) => {
    const panel = target.closest('aside')?.getBoundingClientRect();
    const own = target.getBoundingClientRect();
    if (panel) setOpensLeft(own.left - panel.left > panel.width / 2);
  };
  return (
    <span className="group relative ml-0.5 inline-block align-super leading-none">
      <button
        type="button"
        onClick={onSelect}
        onMouseEnter={(e) => place(e.currentTarget)}
        onFocus={(e) => place(e.currentTarget)}
        className="rounded px-0.5 font-medium text-[0.7rem] text-series-1 hover:bg-hairline/60"
      >
        {label}
      </button>
      <span
        role="tooltip"
        className={`hidden absolute bottom-full z-20 mb-1 w-80 whitespace-normal rounded-md border border-hairline bg-surface p-3 text-left font-normal text-ink-secondary text-xs leading-relaxed shadow-md group-focus-within:block group-hover:block ${opensLeft ? 'right-0' : 'left-0'}`}
      >
        {children}
      </span>
    </span>
  );
}

/** Scrolls to a source in the panel, a note or a fact, and marks it for a moment. */
function mark(elementId: string) {
  const element = document.getElementById(elementId);
  if (!element) return;
  element.scrollIntoView({ behavior: 'smooth', block: 'center' });
  element.classList.add('ring-2', 'ring-series-1');
  setTimeout(() => element.classList.remove('ring-2', 'ring-series-1'), 1600);
}

function Check({ story }: { story: CustomerStory }) {
  const { ok, problems, checked } = story.check;
  if (ok) {
    return (
      <p className="mt-4 border-hairline border-t pt-3 text-ink-muted text-xs">
        ✓ Checked: its {checked.citations} citations exist, and its {checked.numbers} amounts and {checked.dates} dates
        are in what it cites.
      </p>
    );
  }
  return (
    <div className="mt-4 border-hairline border-t pt-3 text-xs">
      <p className="font-medium">⚠ The check found {problems.length} problems:</p>
      <ul className="mt-1 list-disc pl-4 text-ink-secondary">
        {problems.map((p) => (
          <li key={p}>{p}</li>
        ))}
      </ul>
    </div>
  );
}
