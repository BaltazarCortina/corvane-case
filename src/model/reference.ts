// Reads config/reference.yml: facts about Corvane the exports do not carry (its fiscal calendar) and the
// canonical values for states, industries and service lines, with the spellings each one appears under.

import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { z } from 'zod';
import { formatIssues } from '../shared/validation';

const spellings = z.record(z.string(), z.array(z.string()));

const schema = z.object({
  /** Month the fiscal year starts in, 1 to 12. */
  fiscalYearStartMonth: z.number().int().min(1).max(12),
  states: spellings,
  industries: spellings,
  serviceLines: spellings,
});

export type Reference = z.infer<typeof schema>;

export function parseReference(text: string): Reference {
  const result = schema.safeParse(parse(text));
  if (!result.success) {
    const issues = formatIssues(result.error);
    throw new Error(`Invalid reference data: ${issues}`);
  }
  return result.data;
}

export const loadReference = (file: string) => parseReference(readFileSync(file, 'utf8'));

/**
 * Builds a case-insensitive lookup from every spelling, and each canonical value itself, to the
 * canonical value. A spelling listed under two canonical values is an error, not a silent pick.
 */
export function lookup(values: Record<string, string[]>): (raw: string) => string | null {
  const map = new Map<string, string>();
  for (const [canonical, list] of Object.entries(values)) {
    for (const spelling of [canonical, ...list]) {
      const key = spelling.trim().toLowerCase();
      const existing = map.get(key);
      if (existing && existing !== canonical) {
        throw new Error(`"${spelling}" is listed under both "${existing}" and "${canonical}"`);
      }
      map.set(key, canonical);
    }
  }
  return (raw) => map.get(raw.trim().toLowerCase()) ?? null;
}
