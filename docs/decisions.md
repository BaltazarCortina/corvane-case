# Decisions

The choices behind the numbers in the app, and why. Each one is tagged with its kind:

- **Mechanical:** a transformation with no judgment involved, like reading a date format.
- **Criterion:** a choice that could reasonably have gone another way. These are the ones to defend, and
  the ones Corvane may need to confirm.

When a decision can be changed without touching code, it names the setting that changes it.

## Reading the exports

### Slash dates are month first

**Mechanical.** `04/01/2024` is April 1. Of the 2,464 slash dates in the QuickBooks and CRM exports, 511
have a second number above 12 and none has a first number above 12.

### Amounts in parentheses are negative

**Mechanical.** `($1,212.32)` is the accounting convention for a negative amount. In QuickBooks these are
the credit memos.

### Lines that are not data are set aside, not parsed

**Mechanical.** The QuickBooks export repeats its header in the middle of the file and ends with a TOTAL
row. Neither is an invoice. The TOTAL is kept, because the parsed invoices must add up to it exactly.

### Exact duplicate rows are marked, not removed

**Mechanical.** A row identical in every column to an earlier one is kept and points to the line of the
first. Whether it counts is decided later, where its impact can be measured and shown.

### Spellings are unified through reference data

**Mechanical.** Set by `states` and `industries` in `config/reference.yml`. States (`OH`, `Oh.`, `Ohio`),
industries (`Property Mgmt`, `Real Estate / Property`) and text variants (`Monthly`, `monthly`) become
one value. A value with no mapping is kept as exported and reported, never dropped.

### QuickBooks memos are mapped to NetSuite service lines

**Criterion.** Set by `serviceLines` in `config/reference.yml`. NetSuite records a service line on every
invoice; QuickBooks only has a free-text memo. Each memo is assigned to the service line that describes
the same work, so both systems can be compared by line. QuickBooks credit memos name no service, so they
get a line of their own, "Unallocated credit".

### A value that cannot be read stops the pipeline

**Criterion.** Dates and amounts are required: if one does not parse, the export changed and a silent
guess would move the numbers. Values the analysis can work without (a contract's annual value or
auto-renewal, a customer's account manager) are kept as unknown when empty.

## Who is who

### Names match on a normalized key, nothing fuzzier

**Criterion.** Two names are the same company when they are equal once case, punctuation, `&` and a
trailing legal suffix (Inc, LLC, Corp, Ltd) are ignored. A fuzzy match would join "Halloran Academy" and
"Halloran Health Partners", which are different customers. What the rules cannot link is listed, not
guessed.

### Duplicate CRM records are merged when the location matches too

**Criterion.** Rule `duplicateCustomers` in `config/assumptions.yml`. CRM records with the same
normalized name **and** the same city and state are one customer, billed under both ids. Records that
share a name but not the location are kept apart as possible duplicates. The merged customer takes its id
from the oldest record, the name as written without capitals or a legal suffix, the earliest creation
date, and every account manager named on its records, so a disagreement between them stays visible.

### Shortened names in the notes are accepted when unique

**Criterion.** Rule `shortenedNoteNames` in `config/assumptions.yml`. Account managers often shorten
names ("Kessler Surgical"). A note name of two or more words is linked when exactly one customer's name
starts with those words. Shorter or ambiguous names stay unmatched, and an ambiguous one keeps the
customers it fits as candidates. Notes linked to no customer are shown on the Data screen, because what
they say does not reach the risk analysis.

### Ids missing from the CRM are customers of their own

**Criterion.** Changed case by case with `assignments` in `config/assumptions.yml`. A customer id billed
in NetSuite or named in a contract but missing from the CRM is kept as a customer of its own, named by
its id, rather than dropped or guessed. Names that no rule links (in QuickBooks or the notes) stay
unlinked and are listed.

### A person's decision wins over the rules

**Criterion.** Set by `exceptions` on each rule and by `assignments` in `config/assumptions.yml`. Each
rule can be turned off, and single cases can be excepted from it. Assignments link what no rule can, such
as a QuickBooks name to a customer id. Both are applied before the rules, keyed by values that survive a
new export (a CRM id, a name as written), and an entry that no longer matches anything in the data is
reported.

## What counts as billing

### Every invoice row is kept and marked

**Mechanical.** Invoices from both systems go into one table. Nothing is deleted: each row says whether
it counts or which rule excludes it, so the exported totals reconcile with the counted ones rule by rule,
to the cent. Amounts are added in whole cents to avoid floating point drift.

### Exact duplicate invoices do not count

**Criterion.** Rule `duplicateInvoices` in `config/assumptions.yml`. A row identical in every column to
an earlier one, invoice number included, is taken as an export error. A second charge to the same
customer would have its own invoice number. All 45 copies in NetSuite sit on the line right after their
original. If they were real charges, the rule can be turned off or excepted invoice by invoice.

### Voided invoices do not count

**Criterion.** Rule `voidedInvoices` in `config/assumptions.yml`. An invoice marked as void in the
billing system was cancelled. QuickBooks has no voided invoices in this export.

### Credit memos reduce billing in the month they are issued

**Criterion.** Rule `creditMemos` in `config/assumptions.yml`. A credit memo does not say which invoice
it corrects, so it is netted in the month it is issued, not in the month of the invoice it may refer to.

### Invoices with no customer are kept as unassigned

**Criterion.** Changed case by case with `assignments` in `config/assumptions.yml`. An invoice whose
customer cannot be found still counts toward the totals, under "unassigned", so the totals keep matching
the exports while the link is resolved.

## Contracts

### A contract that ends before it starts has an unknown end

**Criterion.** Rule `impossibleContractDates` in `config/assumptions.yml`. The end falls one or more
years before the start, which looks like a mistyped year, but the right year cannot be told from the
data. Taking it as exported would make the contract look expired; guessing a year would invent a renewal
date. Turned off, the rule takes the end as exported.

### Duplicate contract rows count once

**Mechanical.** A contract row identical to an earlier one is kept, marked, and ignored when choosing the
current contract.

### The current contract is the one that started last

**Criterion.** A renewal starts after the contract it renews, so when a customer has several contracts,
the one with the latest start is the current one.
