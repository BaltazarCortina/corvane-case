// Reads config/assumptions.yml: the rules we chose where the data allows more than one reading,
// whether Corvane confirmed them, and the cases a person decided by hand. A value the code does not
// know fails with its exact path instead of falling back to a default.

import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { z } from 'zod';

const rule = z.strictObject({
  applies: z.boolean(),
  confirmed: z.boolean(),
  basis: z.string(),
  /** Keys of the cases where the opposite of the rule holds. */
  exceptions: z.array(z.string()).default([]),
});

const assignment = z.strictObject({
  /** Where the value comes from: a customer name in QuickBooks or the notes, or a NetSuite customer id. */
  source: z.enum(['quickbooks', 'notes', 'netsuite']),
  value: z.string(),
  /** The customer id it belongs to. */
  customer: z.string(),
  confirmed: z.boolean(),
  evidence: z.string(),
});

const schema = z.strictObject({
  duplicateCustomers: rule,
  shortenedNoteNames: rule,
  duplicateInvoices: rule,
  voidedInvoices: rule,
  creditMemos: rule,
  impossibleContractDates: rule,
  /** Links for values no rule can make, decided by a person. */
  assignments: z.array(assignment).default([]),
});

export type Assumptions = z.infer<typeof schema>;
export type Rule = z.infer<typeof rule>;
export type Assignment = z.infer<typeof assignment>;

/**
 * Whether a rule holds for one case. `covered` says whether the rule speaks about that case at all;
 * an exception flips the outcome either way.
 */
export function holds(rule: Rule, key: string, covered = true): boolean {
  return (covered && rule.applies) !== rule.exceptions.includes(key);
}

export function parseAssumptions(text: string): Assumptions {
  const data = parse(text);
  const result = schema.safeParse(data);
  if (!result.success) {
    const issues = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Invalid assumptions: ${issues}`);
  }
  return result.data;
}

export function loadAssumptions(file: string): Assumptions {
  const text = readFileSync(file, 'utf8');
  return parseAssumptions(text);
}
