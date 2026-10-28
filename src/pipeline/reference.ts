// Reads config/reference.yml: the canonical values for states, industries and service lines,
// with the spellings each one appears under in the exports.

import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { z } from 'zod';

const spellings = z.record(z.string(), z.array(z.string()));

const schema = z.object({
  states: spellings,
  industries: spellings,
  serviceLines: spellings,
});

export type Reference = z.infer<typeof schema>;

export function parseReference(text: string): Reference {
  const result = schema.safeParse(parse(text));
  if (!result.success) {
    const issues = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
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
