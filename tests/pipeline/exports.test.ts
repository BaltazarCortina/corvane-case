import { describe, expect, it } from 'vitest';
import { parseCsv } from '../../src/pipeline/exports';

describe('parseCsv', () => {
  it('fails when a column the pipeline reads is missing', () => {
    expect(() => parseCsv('notes', 'note_id,customer_name\nN-1,Acme')).toThrow(/missing columns note_date/);
  });

  it('keeps the line number of each row, the header being line 1', () => {
    const rows = parseCsv(
      'notes',
      'note_id,customer_name,note_date,author,note_text\nN-1,A,2025-01-01,X,Hi\nN-2,B,2025-01-02,Y,Bye',
    );
    expect(rows.map((r) => r.line)).toEqual([2, 3]);
  });
});
