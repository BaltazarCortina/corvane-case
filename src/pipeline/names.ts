// Company name rules used to match records across files.

const LEGAL_SUFFIXES = new Set(['inc', 'llc', 'corp', 'ltd']);

const tokens = (name: string) =>
  name
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9 ]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

/**
 * The key two names must share to be the same company: case, punctuation, `&` and trailing legal
 * suffixes are ignored. Nothing fuzzier on purpose: "Halloran Academy" and "Halloran Health
 * Partners" are different customers.
 */
export function normalizeName(name: string): string {
  const t = tokens(name);
  while (t.length > 1 && LEGAL_SUFFIXES.has(t[t.length - 1])) t.pop();
  return t.join(' ');
}

/** Whether normalizing the name removes a legal suffix from it. */
export function hasLegalSuffix(name: string): boolean {
  return normalizeName(name) !== tokens(name).join(' ');
}

export function isAllCaps(name: string): boolean {
  return /[A-Z]/.test(name) && name === name.toUpperCase();
}
