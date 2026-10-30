// What the data says about itself, in business language. Two kinds of finding: assumptions, choices of
// ours that move the numbers, each with its impact; and observations, which do not move the numbers but
// say what is worth knowing or checking with Corvane.

import { type Built, build } from '../build';
import type { RuleName } from '../model/assumptions';
import type { Inputs } from '../model/build';
import type { Invoice } from '../model/model';
import { monthLabel, monthOf } from '../shared/calendar';
import { count, percent, usd } from '../shared/format';
import { sumMoney } from '../shared/money';
import { customerNames, type Finding, type FindingCase, type Impact, invoiceCase } from './cases';
import { observationFindings } from './observations';

export function detectFindings(inputs: Inputs, built: Built): Finding[] {
  const reversedBy = (rule: RuleName) => build(withRuleReversed(inputs, rule));
  const assumptions = [
    invoiceRuleFinding('duplicateInvoices', inputs, built, reversedBy('duplicateInvoices')),
    invoiceRuleFinding('voidedInvoices', inputs, built, reversedBy('voidedInvoices')),
    invoiceRuleFinding('creditMemos', inputs, built, reversedBy('creditMemos')),
    duplicateCustomersFinding(inputs, built, reversedBy('duplicateCustomers')),
    shortenedNamesFinding(inputs, built, reversedBy('shortenedNoteNames')),
    contractDatesFinding(inputs, built, reversedBy('impossibleContractDates')),
    assignmentsFinding(inputs, built),
  ];
  const observations = observationFindings(inputs, built);
  return [...assumptions, ...observations].filter((f): f is Finding => f !== null && f.cases.length > 0);
}

/** The same inputs with one rule turned the other way, to measure what it changes. */
export function withRuleReversed(inputs: Inputs, rule: RuleName): Inputs {
  const current = inputs.assumptions[rule];
  const reversedRule = { ...current, applies: !current.applies };
  const assumptions = { ...inputs.assumptions, [rule]: reversedRule };
  return { ...inputs, assumptions };
}

function ruleOf(inputs: Inputs, name: RuleName): Finding['rule'] {
  const { applies, confirmed, basis } = inputs.assumptions[name];
  return { name, applies, confirmed, basis };
}

function halfImpact(built: Built, reversed: Built): Impact {
  const { current, previous } = built.billing.half.window;
  return {
    measure: `${current.label} against ${previous.label}`,
    unit: 'percent',
    asConfigured: built.billing.half.total.changePct,
    ifReversed: reversed.billing.half.total.changePct,
  };
}

type InvoiceRule = Extract<RuleName, 'duplicateInvoices' | 'voidedInvoices' | 'creditMemos'>;

const INVOICE_RULES: Record<InvoiceRule, { title: string; whatItIs: (n: number, amount: string) => string }> = {
  duplicateInvoices: {
    title: 'Duplicate invoices',
    whatItIs: (n, amount) =>
      `${count(n, 'invoice')} (${amount}) are exact copies of the row before them, invoice number included`,
  },
  voidedInvoices: {
    title: 'Voided invoices',
    whatItIs: (n, amount) => `${count(n, 'invoice')} (${amount}) are marked as void in the billing system`,
  },
  creditMemos: {
    title: 'Credit memos',
    whatItIs: (n, amount) => `${count(n, 'credit memo')} (${amount}) reduce billing in the month they are issued`,
  },
};

/** An invoice rule: the invoices that would count differently if it were reversed, and what that moves. */
function invoiceRuleFinding(name: InvoiceRule, inputs: Inputs, built: Built, reversed: Built): Finding {
  const changed = built.model.invoices.filter(
    (invoice, i) => invoice.excludedBy !== reversed.model.invoices[i].excludedBy,
  );
  const names = customerNames(built.model);
  const cases = changed.map((invoice) => invoiceCase(invoice, names));
  const amounts = changed.map((i) => i.amount);
  const amount = sumMoney(amounts);
  const impact = halfImpact(built, reversed);
  const { title, whatItIs } = INVOICE_RULES[name];
  const rule = ruleOf(inputs, name);
  const counted = changed.some((i) => i.excludedBy === null);
  const treatment = counted ? 'They count toward billing.' : 'They do not count toward billing.';
  const months = monthSpan(changed);
  const summary = `${whatItIs(changed.length, usd(amount))}, ${months}. ${treatment} Reversed, ${impact.measure} would be ${percent(impact.ifReversed)} instead of ${percent(impact.asConfigured)}.`;
  return { id: name, kind: 'assumption', worthChecking: false, title, summary, rule, impact, amount, cases };
}

function duplicateCustomersFinding(inputs: Inputs, built: Built, reversed: Built): Finding {
  const { model } = built;
  const cases = model.duplicateGroups.map((group): FindingCase => {
    const customerId = model.customers.find((c) => c.crmIds.includes(group.crmIds[0]))?.id ?? null;
    const shared = monthsBilledUnderEach(model.invoices, group.crmIds);
    const location = group.sameLocation ? 'Same city and state' : 'Different locations';
    const treatment = group.merged ? 'merged' : 'kept apart';
    return {
      key: group.key,
      label: group.crmIds.join(' and '),
      customerId,
      amount: null,
      detail: `${location}, ${treatment}. Billed under both ids in ${shared.both} of ${shared.any} months.`,
    };
  });
  const merged = model.duplicateGroups.filter((g) => g.merged).length;
  const stopped = (b: Built) => b.billing.bridge.steps.find((s) => s.kind === 'stopped')?.movers.length ?? 0;
  const { current, previous } = built.billing.half.window;
  const impact: Impact = {
    measure: `Customers that stopped billing, ${previous.label} to ${current.label}`,
    unit: 'count',
    asConfigured: stopped(built),
    ifReversed: stopped(reversed),
  };
  const summary = `${count(model.duplicateGroups.length, 'company', 'companies')} appear under more than one CRM id; ${merged} are treated as one customer each. Kept apart, ${impact.ifReversed} customers would look like they stopped billing instead of ${impact.asConfigured}, because their invoices alternate between the ids.`;
  return {
    id: 'duplicateCustomers',
    kind: 'assumption',
    worthChecking: false,
    title: 'Customers with more than one CRM record',
    summary,
    rule: ruleOf(inputs, 'duplicateCustomers'),
    impact,
    amount: null,
    cases,
  };
}

/** In how many months a company was billed under each of its ids, and under any of them. */
function monthsBilledUnderEach(invoices: Invoice[], crmIds: string[]): { both: number; any: number } {
  const monthsById = crmIds.map((id) => {
    const own = invoices.filter((i) => i.source === 'netsuite' && i.customerAsExported === id);
    const months = own.map((i) => monthOf(i.date));
    return new Set(months);
  });
  const all = new Set(monthsById.flatMap((months) => [...months]));
  const both = [...all].filter((month) => monthsById.every((months) => months.has(month)));
  return { both: both.length, any: all.size };
}

function shortenedNamesFinding(inputs: Inputs, built: Built, reversed: Built): Finding {
  const { model } = built;
  const names = customerNames(model);
  const cases = model.shortenedNames.map((s): FindingCase => {
    const notes = model.notes.filter((n) => n.nameAsWritten === s.name).length;
    return {
      key: s.name,
      label: `"${s.name}" → ${names.get(s.customerId)}`,
      customerId: s.customerId,
      amount: null,
      detail: `${count(notes, 'note')}, ${s.accepted ? 'linked' : 'not linked'}.`,
    };
  });
  const linked = (b: Built) => b.model.notes.filter((n) => n.customerId !== null).length;
  const impact: Impact = {
    measure: 'Notes linked to a customer',
    unit: 'count',
    asConfigured: linked(built),
    ifReversed: linked(reversed),
  };
  const summary = `${count(cases.length, 'name')} in the account notes are shortened ("${cases[0]?.key ?? ''}") and match the start of exactly one customer's name. Reversed, ${impact.ifReversed} notes would be linked to a customer instead of ${impact.asConfigured}.`;
  return {
    id: 'shortenedNoteNames',
    kind: 'assumption',
    worthChecking: false,
    title: 'Shortened names in the notes',
    summary,
    rule: ruleOf(inputs, 'shortenedNoteNames'),
    impact,
    amount: null,
    cases,
  };
}

function contractDatesFinding(inputs: Inputs, built: Built, reversed: Built): Finding {
  const { model, billing } = built;
  const names = customerNames(model);
  const impossible = model.contracts.filter((c) => c.endAsExported < c.start && c.duplicateOf === null);
  const cases = impossible.map(
    (c): FindingCase => ({
      key: c.id,
      label: `${c.id} · ${names.get(c.customerId)}`,
      customerId: c.customerId,
      amount: c.annualValue,
      detail: `Starts ${c.start}, ends ${c.endAsExported} as exported.`,
    }),
  );
  const expired = (b: Built) => {
    const current = new Set(b.model.customers.map((c) => c.contractId));
    return b.model.contracts.filter((c) => current.has(c.id) && c.end !== null && c.end < b.billing.asOf).length;
  };
  const impact: Impact = {
    measure: `Current contracts already ended on ${billing.asOf}`,
    unit: 'count',
    asConfigured: expired(built),
    ifReversed: expired(reversed),
  };
  const summary = `${count(cases.length, 'contract')} end before they start, which looks like a mistyped year. Their end is taken as unknown. Taken as exported, ${impact.ifReversed} current contracts would look already ended instead of ${impact.asConfigured}.`;
  return {
    id: 'impossibleContractDates',
    kind: 'assumption',
    worthChecking: false,
    title: 'Contracts that end before they start',
    summary,
    rule: ruleOf(inputs, 'impossibleContractDates'),
    impact,
    amount: null,
    cases,
  };
}

function assignmentsFinding(inputs: Inputs, built: Built): Finding | null {
  const { assignments } = inputs.assumptions;
  if (assignments.length === 0) return null;
  const names = customerNames(built.model);
  const cases = assignments.map((a): FindingCase => {
    const owner = built.model.customers.find((c) => c.crmIds.includes(a.customer) || c.otherIds.includes(a.customer));
    const status = a.confirmed ? 'Confirmed by Corvane' : 'Our assumption, pending confirmation';
    return {
      key: `${a.source}:${a.value}`,
      label: `${a.value} → ${owner ? names.get(owner.id) : a.customer}`,
      customerId: owner?.id ?? null,
      amount: null,
      detail: `${status}. ${a.evidence}`,
    };
  });
  const pending = assignments.filter((a) => !a.confirmed).length;
  return {
    id: 'assignments',
    kind: 'assumption',
    worthChecking: false,
    title: 'Links decided by hand',
    summary: `${count(cases.length, 'name or id')} no rule could link were linked by hand; ${pending} await confirmation.`,
    rule: null,
    impact: null,
    amount: null,
    cases,
  };
}

/** `all in Jul 2026` or `across 5 months (Apr 2025 – Sep 2026)`. */
function monthSpan(invoices: Invoice[]): string {
  const allMonths = invoices.map((i) => monthOf(i.date));
  const months = [...new Set(allMonths)].sort();
  if (months.length === 0) return 'none';
  const first = monthLabel(months[0]);
  if (months.length === 1) return `all in ${first}`;
  const last = monthLabel(months[months.length - 1]);
  return `across ${months.length} months (${first} – ${last})`;
}
