// Invariants on what the LLM said about the real notes. Skipped until `npm run llm` has written them.

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildModel, loadInputs } from '../../src/model/build';
import { paths } from '../../src/paths';
import type { NoteSignal } from '../../src/risk/notes';
import { readJson } from '../../src/shared/files';

const signalsFile = join(paths.llm, 'note-signals.json');

describe.skipIf(!existsSync(signalsFile))('the note signals', () => {
  const signals = existsSync(signalsFile) ? readJson<NoteSignal[]>(signalsFile) : [];

  it('cover every note, once', () => {
    const model = buildModel(loadInputs(paths));
    const noteIds = model.notes.map((n) => n.id).sort();
    const signalIds = signals.map((s) => s.noteId).sort();
    expect(signalIds).toEqual(noteIds);
  });

  it('justify every risk with a quote found in the note', () => {
    const unverified = signals.filter((s) => !s.quoteVerified).map((s) => s.noteId);
    expect(unverified).toEqual([]);
  });

  it('give reasons only when there is risk', () => {
    for (const signal of signals) {
      if (signal.risk === 'none') expect(signal.reasons).toEqual([]);
    }
  });
});
