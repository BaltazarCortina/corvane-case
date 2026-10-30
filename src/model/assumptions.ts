// Reads config/assumptions.yml: the rules we chose where the data allows more than one reading,
// whether Corvane confirmed them, and the cases a person decided by hand. A value the code does not
// know fails with its exact path instead of falling back to a default.

import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { z } from 'zod';
import { formatIssues } from '../shared/validation';

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

/** Thresholds of the business rules, all our criteria. */
const parameters = z
  .strictObject({
    /** Service lines whose invoices are never atypical, however large. */
    atypicalInvoiceExcludedLines: z.array(z.string()),
    /** An invoice in any other line is atypical from this amount... */
    atypicalInvoiceMinimum: z.number().positive(),
    /** ...if it is also at least this many times what the customer bills in an average month. */
    atypicalInvoiceMultiple: z.number().positive(),
    /** A customer with no invoice for this many days has stopped billing. */
    stoppedBillingDays: z.number().int().positive(),
    /** A contract billed below this share of its value is worth checking... */
    underBilledContractShare: z.number().positive(),
    /** ...and so is one billed above this share. */
    overBilledContractShare: z.number().positive(),
    /** A decline in billing smaller than this amount is not a decline... */
    minimumDeclineAmount: z.number().nonnegative(),
    /** ...and from this share of the earlier billing it is moderate, strong or very strong. */
    moderateDeclineShare: z.number().positive(),
    strongDeclineShare: z.number().positive(),
    veryStrongDeclineShare: z.number().positive(),
    /** A customer at medium risk whose contract ends within this many days needs action now. */
    actNowRenewalDays: z.number().int().nonnegative(),
    /** A contract ending within this many days is an upcoming renewal. */
    upcomingRenewalDays: z.number().int().nonnegative(),
    /** A customer that stopped billing within this many months is worth winning back. */
    winBackMonths: z.number().int().positive(),
  })
  .refine((p) => p.moderateDeclineShare < p.strongDeclineShare && p.strongDeclineShare < p.veryStrongDeclineShare, {
    message: 'decline shares must grow from moderate to very strong',
  })
  .refine((p) => p.actNowRenewalDays <= p.upcomingRenewalDays, {
    message: 'actNowRenewalDays must not exceed upcomingRenewalDays',
  });

const schema = z.strictObject({
  parameters,
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
/** The rules, each a choice that could have gone the other way. */
export type RuleName = Exclude<keyof Assumptions, 'assignments' | 'parameters'>;
export type Parameters = z.infer<typeof parameters>;
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
    const issues = formatIssues(result.error);
    throw new Error(`Invalid assumptions: ${issues}`);
  }
  return result.data;
}

export function loadAssumptions(file: string): Assumptions {
  const text = readFileSync(file, 'utf8');
  return parseAssumptions(text);
}
