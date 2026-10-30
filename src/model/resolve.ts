// Decides which records across the five files are the same customer. Manual assignments come
// first, because a person's decision wins over a rule; then exact and normalized names; then, for
// the notes only, a unique shortened name.

import { groupBy } from '../shared/collections';
import { type Assignment, type Assumptions, holds, type Rule } from './assumptions';
import { hasLegalSuffix, isAllCaps, normalizeName } from './names';
import type { CrmRecord, ParsedExports } from './parse';

export interface Customer {
  /** The id of its main CRM record, or the id it is billed under if it is not in the CRM. */
  id: string;
  name: string;
  inCrm: boolean;
  /** Every CRM record merged into this customer. */
  crmIds: string[];
  /** Ids it is billed or contracted under that are missing from the CRM. */
  otherIds: string[];
  industry: string | null;
  city: string | null;
  state: string | null;
  /** More than one when merged records name different account managers. */
  accountManagers: string[];
  /** The earliest creation date among its CRM records. */
  created: string | null;
  crmStatus: string | null;
}

export interface NameLink {
  customerId: string | null;
  method: 'assigned' | 'exact' | 'normalized' | 'shortened' | null;
  /** For a name left unmatched because it fits more than one customer: those customers. */
  candidates: string[];
}

/** CRM records sharing a normalized name. */
export interface DuplicateGroup {
  key: string;
  crmIds: string[];
  sameLocation: boolean;
  merged: boolean;
}

export interface ShortenedName {
  name: string;
  customerId: string;
  accepted: boolean;
}

export interface Resolution {
  customers: Customer[];
  /** Every CRM id and every id missing from the CRM, to the customer it belongs to. */
  customerOfId: Record<string, string>;
  quickbooksNames: Record<string, NameLink>;
  noteNames: Record<string, NameLink>;
  duplicateGroups: DuplicateGroup[];
  shortenedNames: ShortenedName[];
  /** Config entries that point to nothing in the data or to an unknown customer. */
  configProblems: string[];
}

export function resolveCustomers(parsed: ParsedExports, assumptions: Assumptions): Resolution {
  const { assignments } = assumptions;
  const crmIds = new Set(parsed.crm.map((r) => r.id));

  // Customers: CRM records, merged when duplicated, plus the ids missing from the CRM.
  const { groups, duplicateGroups } = groupDuplicateRecords(parsed.crm, assumptions.duplicateCustomers);
  const crmCustomers = groups.map(customerFromCrm);
  const otherIds = idsOutsideCrm(parsed, crmIds);
  const customers = addIdsOutsideCrm(crmCustomers, otherIds, assignments);
  const customerOfId = indexIds(customers);

  // Names: a person's assignment first, then the names each customer goes by.
  const index = indexNames(parsed.crm, assignments, customerOfId);
  const linkName = (source: Assignment['source'], name: string) =>
    findByAssignment(assignments, customerOfId, source, name) ?? findByName(index, name);
  const quickbooksNameList = parsed.quickbooks.map((i) => i.customerName);
  const noteNameList = parsed.notes.map((n) => n.customerName);
  const quickbooksNames = linkEach(quickbooksNameList, (name) => linkName('quickbooks', name));
  const { noteNames, shortenedNames } = linkNoteNames(
    noteNameList,
    (name) => linkName('notes', name),
    index,
    assumptions.shortenedNoteNames,
  );

  const configProblems = checkConfig(assumptions, {
    crmIds,
    otherIds,
    customerOfId,
    quickbooksNames,
    noteNames,
    duplicateGroups,
    shortenedNames,
  });

  return { customers, customerOfId, quickbooksNames, noteNames, duplicateGroups, shortenedNames, configProblems };
}

/**
 * CRM records that share a normalized name are one customer when they are also in the same city and
 * state, unless an exception says otherwise. Every other record is a group of its own.
 */
function groupDuplicateRecords(crm: CrmRecord[], rule: Rule) {
  const groups: CrmRecord[][] = [];
  const duplicateGroups: DuplicateGroup[] = [];
  const byName = groupBy(crm, (r) => normalizeName(r.name));
  for (const records of byName.values()) {
    if (records.length === 1) {
      groups.push(records);
      continue;
    }
    const crmIds = records.map((r) => r.id).sort();
    const key = crmIds.join('+');
    const locations = records.map((r) => `${r.city.toLowerCase()}|${r.state}`);
    const sameLocation = new Set(locations).size === 1;
    const merged = holds(rule, key, sameLocation);
    duplicateGroups.push({ key, crmIds, sameLocation, merged });
    const separate = records.map((r) => [r]);
    if (merged) groups.push(records);
    else groups.push(...separate);
  }
  return { groups, duplicateGroups };
}

/**
 * One customer from one or more CRM records. The main record is the oldest; the name is the one
 * written without capitals or a legal suffix, if any.
 */
function customerFromCrm(records: CrmRecord[]): Customer {
  const [main] = [...records].sort((a, b) => a.created.localeCompare(b.created) || a.id.localeCompare(b.id));
  // Lower is better: written without capitals first, then without a legal suffix, then the main record.
  const nameRank = (r: CrmRecord) =>
    (isAllCaps(r.name) ? 4 : 0) + (hasLegalSuffix(r.name) ? 2 : 0) + (r === main ? 0 : 1);
  const [named] = [...records].sort((a, b) => nameRank(a) - nameRank(b));
  const accountManagers = records.map((r) => r.accountManager).filter((m) => m !== null);
  return {
    id: main.id,
    name: named.name,
    inCrm: true,
    crmIds: records.map((r) => r.id).sort(),
    otherIds: [],
    industry: main.industry,
    city: main.city,
    state: main.state,
    accountManagers: [...new Set(accountManagers)].sort(),
    created: main.created,
    crmStatus: main.status,
  };
}

/** Customer ids billed in NetSuite or named in a contract that are missing from the CRM. */
function idsOutsideCrm(parsed: ParsedExports, crmIds: Set<string>): string[] {
  const ids = [...parsed.netsuite, ...parsed.contracts].map((r) => r.customerId);
  return [...new Set(ids)].filter((id) => !crmIds.has(id)).sort();
}

/** Each id missing from the CRM joins the CRM customer it is assigned to, or becomes a customer of its own. */
function addIdsOutsideCrm(customers: Customer[], ids: string[], assignments: Assignment[]): Customer[] {
  const outside: Customer[] = [];
  for (const id of ids) {
    const target = assignmentFor(assignments, 'netsuite', id)?.customer;
    const owner = customers.find((c) => target !== undefined && c.crmIds.includes(target));
    if (owner) {
      owner.otherIds.push(id);
      continue;
    }
    const customer = customerOutsideCrm(id, assignments);
    outside.push(customer);
  }
  return [...customers, ...outside];
}

/** A customer missing from the CRM, named after the QuickBooks name assigned to it, if any. */
function customerOutsideCrm(id: string, assignments: Assignment[]): Customer {
  const name = assignments.find((a) => a.source === 'quickbooks' && a.customer === id)?.value ?? id;
  return {
    id,
    name,
    inCrm: false,
    crmIds: [],
    otherIds: [id],
    industry: null,
    city: null,
    state: null,
    accountManagers: [],
    created: null,
    crmStatus: null,
  };
}

/** Every id a customer is known by, CRM or not, to the customer's id. */
function indexIds(customers: Customer[]): Record<string, string> {
  const pairs = customers.flatMap((c) => [...c.crmIds, ...c.otherIds].map((id) => [id, c.id]));
  return Object.fromEntries(pairs);
}

const assignmentFor = (assignments: Assignment[], source: Assignment['source'], value: string) =>
  assignments.find((a) => a.source === source && a.value === value);

function findByAssignment(
  assignments: Assignment[],
  customerOfId: Record<string, string>,
  source: Assignment['source'],
  name: string,
): NameLink | null {
  const target = assignmentFor(assignments, source, name)?.customer;
  const customerId = target ? customerOfId[target] : undefined;
  return customerId ? { customerId, method: 'assigned', candidates: [] } : null;
}

/** The names each customer goes by, as written and normalized. */
interface NameIndex {
  exact: Map<string, Set<string>>;
  normalized: Map<string, Set<string>>;
}

/** Indexes each customer's CRM names and the QuickBooks names assigned to it. */
function indexNames(crm: CrmRecord[], assignments: Assignment[], customerOfId: Record<string, string>): NameIndex {
  const entries: [string, string][] = crm.map((r) => [r.name, customerOfId[r.id]]);
  for (const a of assignments) {
    if (a.source === 'quickbooks' && customerOfId[a.customer]) entries.push([a.value, customerOfId[a.customer]]);
  }
  const index: NameIndex = { exact: new Map(), normalized: new Map() };
  for (const [name, customerId] of entries) {
    const normalized = normalizeName(name);
    addTo(index.exact, name, customerId);
    addTo(index.normalized, normalized, customerId);
  }
  return index;
}

/**
 * The customer with exactly this name, as written or normalized. A name that fits more than one
 * customer is left unmatched, with those customers as candidates.
 */
function findByName(index: NameIndex, name: string): NameLink {
  const exact = index.exact.get(name) ?? new Set();
  if (exact.size === 1) return { customerId: [...exact][0], method: 'exact', candidates: [] };
  const key = normalizeName(name);
  const normalized = index.normalized.get(key) ?? new Set();
  if (normalized.size === 1) return { customerId: [...normalized][0], method: 'normalized', candidates: [] };
  return { customerId: null, method: null, candidates: [...normalized].sort() };
}

/** Customers whose name starts with a shortened name of two or more words. */
function shortenedNameCandidates(index: NameIndex, name: string): string[] {
  const prefix = normalizeName(name);
  if (prefix.split(' ').length < 2) return [];
  const matches = new Set<string>();
  for (const [full, ids] of index.normalized) {
    if (full !== prefix && !full.startsWith(`${prefix} `)) continue;
    for (const id of ids) matches.add(id);
  }
  return [...matches].sort();
}

/**
 * Links note names like any other name, then tries a shortened name for those that fit no customer:
 * linked if it fits exactly one, left unmatched with its candidates if it fits more.
 */
function linkNoteNames(names: string[], link: (name: string) => NameLink, index: NameIndex, rule: Rule) {
  const noteNames = linkEach(names, link);
  const shortenedNames: ShortenedName[] = [];
  for (const [name, found] of Object.entries(noteNames)) {
    if (found.customerId || found.candidates.length) continue;
    const candidates = shortenedNameCandidates(index, name);
    if (candidates.length > 1) noteNames[name] = { ...found, candidates };
    if (candidates.length !== 1) continue;
    const [customerId] = candidates;
    const accepted = holds(rule, name);
    shortenedNames.push({ name, customerId, accepted });
    if (accepted) noteNames[name] = { customerId, method: 'shortened', candidates: [] };
  }
  return { noteNames, shortenedNames };
}

/** Links each distinct name. */
function linkEach(names: string[], link: (name: string) => NameLink): Record<string, NameLink> {
  const out: Record<string, NameLink> = {};
  for (const name of new Set(names)) out[name] = link(name);
  return out;
}

/** Config entries that point to nothing in the data or to a customer that does not exist. */
function checkConfig(
  assumptions: Assumptions,
  found: Pick<Resolution, 'customerOfId' | 'quickbooksNames' | 'noteNames' | 'duplicateGroups' | 'shortenedNames'> & {
    crmIds: Set<string>;
    otherIds: string[];
  },
): string[] {
  const problems: string[] = [];
  const values: Record<Assignment['source'], string[]> = {
    quickbooks: Object.keys(found.quickbooksNames),
    notes: Object.keys(found.noteNames),
    netsuite: found.otherIds,
  };
  for (const a of assumptions.assignments) {
    const entry = `${a.source}:${a.value}`;
    if (!values[a.source].includes(a.value)) problems.push(`${entry} is assigned but not in the data`);
    const validTarget = a.source === 'netsuite' ? found.crmIds.has(a.customer) : a.customer in found.customerOfId;
    const expected = a.source === 'netsuite' ? 'a CRM customer' : 'a known customer';
    if (!validTarget) problems.push(`${entry} is assigned to ${a.customer}, which is not ${expected}`);
  }
  for (const key of assumptions.duplicateCustomers.exceptions) {
    if (!found.duplicateGroups.some((g) => g.key === key))
      problems.push(`duplicate customers ${key} is not in the data`);
  }
  for (const name of assumptions.shortenedNoteNames.exceptions) {
    if (!found.shortenedNames.some((s) => s.name === name)) problems.push(`shortened name ${name} is not in the data`);
  }
  return problems;
}

function addTo(map: Map<string, Set<string>>, key: string, value: string) {
  const values = map.get(key) ?? new Set<string>();
  values.add(value);
  map.set(key, values);
}
