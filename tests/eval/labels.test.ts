import { describe, expect, it } from 'vitest';
import { parseLabels } from '../../src/eval/labels';

const header = 'note_id,date,name_as_written,text,risk,reasons,note_type,comment';

describe('parseLabels', () => {
  it('reads each label, with reasons split on semicolons, ignoring case and spaces', () => {
    const text = `${header}\nN-1,2025-01-01,Acme,"Text",High, competitor ; Price ,customer,unsure\nN-2,2025-01-02,Acme,"Text",none,,prospect,`;
    expect(parseLabels(text)).toEqual([
      { noteId: 'N-1', risk: 'high', reasons: ['competitor', 'price'], noteType: 'customer', comment: 'unsure' },
      { noteId: 'N-2', risk: 'none', reasons: [], noteType: 'prospect', comment: '' },
    ]);
  });

  it('fails on a value off the scale, naming the line', () => {
    const text = `${header}\nN-1,2025-01-01,Acme,"Text",severe,,customer,`;
    expect(() => parseLabels(text)).toThrow(/line 2: risk/);
  });

  it('fails on a missing label', () => {
    const text = `${header}\nN-1,2025-01-01,Acme,"Text",,,customer,`;
    expect(() => parseLabels(text)).toThrow(/line 2/);
  });

  it('fails on reasons given for a note with no risk', () => {
    const text = `${header}\nN-1,2025-01-01,Acme,"Text",none,price,customer,`;
    expect(() => parseLabels(text)).toThrow(/only for notes with some risk/);
  });
});
