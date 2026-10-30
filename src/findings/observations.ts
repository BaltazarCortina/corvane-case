// Observations: what the data shows that does not move the numbers. Those with money involved or worth
// checking with Corvane come first; the rest are informative.

import { type BilledInvoice, billedInvoices, billingStatus, lastInvoiceOf, totalIn } from '../billing/billing';
import type { Built } from '../build';
import type { Inputs } from '../model/build';
import { type Contract, type CustomerRecord, currentContractOf } from '../model/model';
import { daysIn, monthLabel, monthOf, overlap, type Period } from '../shared/calendar';
import { groupBy } from '../shared/collections';
import { count, percent, usd } from '../shared/format';
import { sumMoney } from '../shared/money';
import { customerNames, type Finding, type FindingCase, invoiceCase } from './cases';

export function observationFindings(inputs: Inputs, built: Built): Finding[] {
  const invoices = billedInvoices(built.model, inputs.assumptions.parameters);
  const activity = customerActivity(invoices, built);
  return [
    ...contractBillingFindings(inputs, built, activity),
    expiredContractsFinding(inputs, built, activity),
    systemChangeFinding(built),
    unlinkedNotesFinding(built),
    nameVariantsFinding(built),
    unmappedValuesFinding(built),
    memoTranslationFinding(built),
    atypicalInvoicesFinding(built, invoices),
    noAccountManagerFinding(built, activity),
    crmStatusFinding(inputs, built, activity),
  ];
}

function observation(
  id: string,
  worthChecking: boolean,
  title: string,
  summary: string,
  cases: FindingCase[],
  amount: number | null = null,
): Finding {
  return { id, kind: 'observation', worthChecking, title, summary, rule: null, impact: null, amount, cases };
}

/** For each customer: its last invoice and what it billed in the last twelve months. */
interface Activity {
  lastInvoice: Map<string, string>;
  lastTwelveMonths: Map<string, number>;
  billedIn: (customerId: string, period: Period) => number;
}

function customerActivity(invoices: BilledInvoice[], built: Built): Activity {
  const byCustomer = groupBy(invoices, (i) => i.customerId);
  const twelveMonths = built.billing.twelveMonths.window.current;
  const billedIn = (customerId: string, period: Period) => {
    const own = byCustomer.get(customerId) ?? [];
    return totalIn(own, period);
  };
  const lastInvoice = new Map<string, string>();
  const lastTwelveMonths = new Map<string, number>();
  for (const [customerId, own] of byCustomer) {
    if (customerId === null) continue;
    const last = lastInvoiceOf(own);
    if (last !== null) lastInvoice.set(customerId, last);
    lastTwelveMonths.set(customerId, billedIn(customerId, twelveMonths));
  }
  return { lastInvoice, lastTwelveMonths, billedIn };
}

function currentContracts(built: Built): { customer: CustomerRecord; contract: Contract }[] {
  const contractOf = currentContractOf(built.model);
  const pairs = built.model.customers.map((customer) => {
    const contract = contractOf(customer);
    return contract ? { customer, contract } : null;
  });
  return pairs.filter((p) => p !== null);
}

/**
 * Contracts billed far below or above their value. A contract's expected billing is its annual value
 * prorated over the part of the last twelve months it was in force; at least three months of it, so a
 * contract that just started is not flagged.
 */
function contractBillingFindings(inputs: Inputs, built: Built, activity: Activity): Finding[] {
  const { underBilledContractShare, overBilledContractShare } = inputs.assumptions.parameters;
  const twelveMonths = built.billing.twelveMonths.window.current;
  const under: FindingCase[] = [];
  const over: FindingCase[] = [];
  for (const { customer, contract } of currentContracts(built)) {
    if (contract.annualValue === null) continue;
    const inForce = { label: contract.id, start: contract.start, end: contract.end ?? twelveMonths.end };
    const measured = overlap(inForce, twelveMonths);
    if (!measured || daysIn(measured) < 90) continue;
    const expected = (contract.annualValue * daysIn(measured)) / 365;
    const billed = activity.billedIn(customer.id, measured);
    const share = billed / expected;
    const lastInvoice = activity.lastInvoice.get(customer.id) ?? 'never';
    const endUnknown = contract.end === null ? ' The contract end is unknown.' : '';
    const detail = `Billed ${usd(billed)} of ${usd(expected)} expected from ${measured.start} to ${measured.end} (${Math.round(share * 100)}%). Last invoice: ${lastInvoice}.${endUnknown}`;
    const entry = { key: contract.id, label: `${customer.name} · ${contract.id}`, customerId: customer.id, detail };
    if (share < underBilledContractShare) under.push({ ...entry, amount: sumMoney([expected, -billed]) });
    if (share > overBilledContractShare) over.push({ ...entry, amount: sumMoney([billed, -expected]) });
  }
  const underAmounts = under.map((c) => c.amount ?? 0);
  const underTotal = sumMoney(underAmounts);
  return [
    observation(
      'contractsBilledUnder',
      true,
      'Contracts billed well below their value',
      `${count(under.length, 'contract')} in force billed less than ${Math.round(underBilledContractShare * 100)}% of their value over the last twelve months, ${usd(underTotal)} below what they should bill. It may be work done and not invoiced, or a cancellation nobody recorded.`,
      under,
      underTotal,
    ),
    observation(
      'contractsBilledOver',
      true,
      'Customers billed well above their contract',
      `${count(over.length, 'customer')} billed more than ${Math.round(overBilledContractShare * 100)}% of their contract value over the last twelve months: work beyond the contract, or a contract value out of date.`,
      over,
    ),
  ];
}

/** Customers still billing on a contract that has ended, with no newer contract on file. */
function expiredContractsFinding(inputs: Inputs, built: Built, activity: Activity): Finding {
  const { asOf } = built.billing;
  const { parameters } = inputs.assumptions;
  const cases: FindingCase[] = [];
  for (const { customer, contract } of currentContracts(built)) {
    const lastInvoice = activity.lastInvoice.get(customer.id) ?? null;
    const status = billingStatus(lastInvoice, asOf, parameters);
    if (contract.end === null || contract.end >= asOf || status !== 'billing') continue;
    cases.push({
      key: contract.id,
      label: `${customer.name} · ${contract.id}`,
      customerId: customer.id,
      amount: activity.lastTwelveMonths.get(customer.id) ?? 0,
      detail: `Contract ended ${contract.end}; last invoice ${lastInvoice}.`,
    });
  }
  return observation(
    'expiredContractsStillBilling',
    true,
    'Expired contracts still billing',
    `${count(cases.length, 'customer')} kept billing after their contract ended, with no newer contract on file: a month-to-month arrangement or a renewal that was not recorded.`,
    cases,
  );
}

/**
 * Whether billing jumped when the billing system changed. Flagged only when the move that month is
 * larger than every other month-to-month move in the data.
 */
function systemChangeFinding(built: Built): Finding {
  const { months, systemChange } = built.billing;
  const moves = months.slice(1).map((point, i) => {
    const before = months[i].total;
    return { month: point.month, change: before === 0 ? 0 : (point.total / before - 1) * 100 };
  });
  const changeMonth = monthOf(systemChange);
  const atChange = moves.find((m) => m.month === changeMonth);
  const others = moves.filter((m) => m.month !== changeMonth).map((m) => m.change);
  if (!atChange) return observation('systemChange', false, 'Billing at the system change', '', []);
  const largest = Math.max(...others.map(Math.abs));
  const flagged = Math.abs(atChange.change) > largest;
  const lowest = Math.min(...others);
  const highest = Math.max(...others);
  const verdict = flagged
    ? 'That is larger than any other month-to-month move in the data: part of it may come from the system change rather than the business.'
    : `That is within the usual month-to-month variation, which ranges from ${percent(lowest)} to ${percent(highest)}.`;
  const summary = `Billing moved ${percent(atChange.change)} in ${monthLabel(changeMonth)}, the first month in NetSuite. ${verdict}`;
  const cases: FindingCase[] = [
    {
      key: changeMonth,
      label: monthLabel(changeMonth),
      customerId: null,
      amount: null,
      detail: percent(atChange.change),
    },
  ];
  return observation('systemChange', flagged, 'Billing at the system change', summary, cases);
}

/** Notes no customer could be found for: what they say does not reach the risk analysis. */
function unlinkedNotesFinding(built: Built): Finding {
  const names = customerNames(built.model);
  const unlinked = built.model.notes.filter((n) => n.customerId === null);
  const cases = unlinked.map((note): FindingCase => {
    const candidates = note.candidates.map((id) => names.get(id)).join(' or ');
    const reason = candidates ? `Fits more than one customer: ${candidates}.` : 'No customer has this name.';
    return {
      key: note.id,
      label: `${note.nameAsWritten} · ${note.date}`,
      customerId: null,
      amount: null,
      detail: `${reason} "${note.text}"`,
    };
  });
  return observation(
    'unlinkedNotes',
    true,
    'Notes linked to no customer',
    `${count(cases.length, 'account note')} could not be linked to a customer, so what they say does not reach the risk analysis. Prospects are expected here; any other name should be resolved.`,
    cases,
  );
}

function nameVariantsFinding(built: Built): Finding {
  const cases: FindingCase[] = [];
  for (const customer of built.model.customers) {
    for (const alias of customer.aliases) {
      if (alias.linkedBy !== 'normalized') continue;
      cases.push({
        key: `${alias.source}:${alias.value}`,
        label: `"${alias.value}" → ${customer.name}`,
        customerId: customer.id,
        amount: null,
        detail: alias.source,
      });
    }
  }
  return observation(
    'nameVariants',
    false,
    'Names written differently across files',
    `${count(cases.length, 'name')} in QuickBooks or the notes differ from the CRM only in case, punctuation or a legal suffix, and were linked to their customer.`,
    cases,
  );
}

/** Values the reference data does not know, kept as exported. */
function unmappedValuesFinding(built: Built): Finding {
  const cases = built.model.unmapped.map(
    (u): FindingCase => ({
      key: `${u.field}:${u.value}`,
      label: `${u.field}: ${u.value}`,
      customerId: null,
      amount: null,
      detail: count(u.rows, 'row'),
    }),
  );
  return observation(
    'unmappedValues',
    false,
    'Values with no mapping',
    `${count(cases.length, 'value')} in the exports have no entry in the reference data and are kept as exported.`,
    cases,
  );
}

/** How each QuickBooks memo was mapped to a service line. */
function memoTranslationFinding(built: Built): Finding {
  const quickbooks = built.model.invoices.filter((i) => i.source === 'quickbooks' && i.memo !== null);
  const byMemo = groupBy(quickbooks, (i) => i.memo ?? '');
  const cases = [...byMemo].map(([memo, own]): FindingCase => {
    const amounts = own.map((i) => i.amount);
    return {
      key: memo,
      label: `${memo} → ${own[0].serviceLine ?? 'no line'}`,
      customerId: null,
      amount: sumMoney(amounts),
      detail: count(own.length, 'invoice'),
    };
  });
  return observation(
    'memoTranslation',
    false,
    'QuickBooks memos mapped to service lines',
    `QuickBooks has a free-text memo instead of a service line. Its ${count(cases.length, 'memo')} were mapped to NetSuite's lines so both systems can be compared by line.`,
    cases,
  );
}

function atypicalInvoicesFinding(built: Built, invoices: BilledInvoice[]): Finding {
  const names = customerNames(built.model);
  const atypical = invoices.filter((i) => i.atypical);
  const cases = atypical.map((invoice) => invoiceCase(invoice, names));
  const amounts = atypical.map((i) => i.amount);
  const total = sumMoney(amounts);
  return observation(
    'atypicalInvoices',
    false,
    'Atypical invoices',
    `${count(cases.length, 'invoice')} (${usd(total)}) are unusually large for their customer and are not inspection or monitoring. Totals are shown with and without them.`,
    cases,
    total,
  );
}

function noAccountManagerFinding(built: Built, activity: Activity): Finding {
  const without = built.model.customers.filter((c) => c.inCrm && c.accountManagers.length === 0);
  const cases = without.map(
    (c): FindingCase => ({
      key: c.id,
      label: c.name,
      customerId: c.id,
      amount: activity.lastTwelveMonths.get(c.id) ?? 0,
      detail: null,
    }),
  );
  return observation(
    'noAccountManager',
    false,
    'Customers without an account manager',
    `${count(cases.length, 'customer')} have no account manager in the CRM, so nobody owns them in the worklist.`,
    cases,
  );
}

/** The CRM status says one thing and billing another. Billing decides; the CRM status is not used. */
function crmStatusFinding(inputs: Inputs, built: Built, activity: Activity): Finding {
  const { parameters } = inputs.assumptions;
  const cases: FindingCase[] = [];
  for (const customer of built.model.customers) {
    if (customer.crmStatus === null) continue;
    const lastInvoice = activity.lastInvoice.get(customer.id) ?? null;
    const billing = billingStatus(lastInvoice, built.billing.asOf, parameters) === 'billing';
    const crmActive = customer.crmStatus === 'active';
    if (crmActive === billing) continue;
    const said = `CRM says ${customer.crmStatus}`;
    const did = billing ? `billed on ${lastInvoice}` : `last invoice ${lastInvoice ?? 'never'}`;
    cases.push({
      key: customer.id,
      label: customer.name,
      customerId: customer.id,
      amount: null,
      detail: `${said}; ${did}.`,
    });
  }
  return observation(
    'crmStatus',
    false,
    'CRM status contradicts billing',
    `${count(cases.length, 'customer')} have a CRM status that contradicts their billing. The app goes by billing.`,
    cases,
  );
}
