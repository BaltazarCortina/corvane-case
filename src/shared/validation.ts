// What failed when a file did not match its schema.

import type { z } from 'zod';

/** Every issue with its path, in one line: `parameters.stoppedBillingDays: Invalid input; ...`. */
export function formatIssues(error: z.ZodError): string {
  const issues = error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
  return issues.join('; ');
}
