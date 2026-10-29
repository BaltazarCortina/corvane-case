// Reads the hand labels in eval/labels.csv. A value off the scale fails with its line, so a typo cannot
// quietly count as a wrong answer of the LLM.

import { readFileSync } from 'node:fs';
import { parse } from 'csv-parse/sync';
import { z } from 'zod';
import { NOTE_TYPES, type NoteType, REASONS, type Reason, RISK_LEVELS, type RiskLevel } from './scale';

export interface Label {
  noteId: string;
  risk: RiskLevel;
  reasons: Reason[];
  noteType: NoteType;
  comment: string;
}

const rowSchema = z.object({
  note_id: z.string().min(1),
  risk: z.enum(RISK_LEVELS),
  reasons: z.array(z.enum(REASONS)),
  note_type: z.enum(NOTE_TYPES),
  comment: z.string(),
});

export function parseLabels(text: string): Label[] {
  const records: { record: Record<string, string>; info: { lines: number } }[] = parse(text, {
    columns: true,
    skip_empty_lines: true,
    bom: true,
    info: true,
  });
  return records.map(({ record, info }) => {
    const reasonList = (record.reasons ?? '').split(';');
    const reasons = reasonList.map((r) => r.trim().toLowerCase()).filter(Boolean);
    const row = {
      note_id: record.note_id?.trim(),
      risk: record.risk?.trim().toLowerCase(),
      reasons,
      note_type: record.note_type?.trim().toLowerCase(),
      comment: record.comment?.trim() ?? '',
    };
    const result = rowSchema.safeParse(row);
    if (!result.success) {
      const issues = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
      throw new Error(`Label on line ${info.lines}: ${issues}`);
    }
    const label = result.data;
    if (label.risk === 'none' && label.reasons.length > 0) {
      throw new Error(`Label on line ${info.lines}: reasons are only for notes with some risk`);
    }
    return {
      noteId: label.note_id,
      risk: label.risk,
      reasons: label.reasons,
      noteType: label.note_type,
      comment: label.comment,
    };
  });
}

export function loadLabels(file: string): Label[] {
  const text = readFileSync(file, 'utf8');
  return parseLabels(text);
}
