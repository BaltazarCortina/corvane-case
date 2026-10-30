// What is pending with Corvane and what we decided ourselves, each in the order it matters.

import type { Finding } from '../../../src/findings/cases';

/**
 * The assumptions still open and the observations worth checking. First what moves the billing figures,
 * the largest move first; then the questions, the most money first; then the rest.
 */
export function pendingWithCorvane(findings: Finding[]): Finding[] {
  const pending = findings.filter((f) => (f.kind === 'assumption' ? f.rule?.status === 'open' : f.worthChecking));
  return byWhatTheyChange(pending);
}

/** The assumptions we decided on the evidence or Corvane confirmed: the criteria the numbers stand on. */
export function ourCalls(findings: Finding[]): Finding[] {
  const settled = findings.filter((f) => f.kind === 'assumption' && f.rule?.status !== 'open');
  return byWhatTheyChange(settled);
}

function byWhatTheyChange(findings: Finding[]): Finding[] {
  const rank = (f: Finding): [number, number] => {
    if (f.impact?.unit === 'percent') return [0, -move(f)];
    if (f.kind === 'observation') return [1, -Math.abs(f.amount ?? 0)];
    return [2, 0];
  };
  return [...findings].sort((a, b) => {
    const [groupA, orderA] = rank(a);
    const [groupB, orderB] = rank(b);
    return groupA - groupB || orderA - orderB;
  });
}

function move(f: Finding): number {
  const { asConfigured, ifReversed } = f.impact ?? {};
  if (asConfigured == null || ifReversed == null) return 0;
  return Math.abs(ifReversed - asConfigured);
}
