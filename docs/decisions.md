# Decisions

The choices behind the numbers in the app, and why. Each one is tagged with its kind:

- **Mechanical:** a transformation with no judgment involved, like reading a date format.
- **Criterion:** a choice that could reasonably have gone another way. These are the ones to defend, and
  the ones Corvane may need to confirm.

## Reading the exports

### Slash dates are month first

**Mechanical.** `04/01/2024` is April 1. Of the 2,464 slash dates in the QuickBooks and CRM exports, 511
have a second number above 12 and none has a first number above 12.

### Amounts in parentheses are negative

**Mechanical.** `($1,212.32)` is the accounting convention for a negative amount. In QuickBooks these
are the credit memos.

### Lines that are not data are set aside, not parsed

**Mechanical.** The QuickBooks export repeats its header in the middle of the file and ends with a TOTAL
row. Neither is an invoice. The TOTAL is kept, because the parsed invoices must add up to it exactly.

### Exact duplicate rows are marked, not removed

**Mechanical.** A row identical in every column to an earlier one is kept and points to the line of the
first. Whether it counts is decided later, where its impact can be measured and shown.

### Spellings are unified through reference data

**Mechanical.** States (`OH`, `Oh.`, `Ohio`), industries (`Property Mgmt`, `Real Estate / Property`) and
text variants (`Monthly`, `monthly`) become one value. The mappings live in `config/reference.yml`. A
value with no mapping is kept as exported and reported, never dropped.

### QuickBooks memos are mapped to NetSuite service lines

**Criterion.** NetSuite records a service line on every invoice; QuickBooks only has a free-text memo.
Each memo is assigned to the service line that describes the same work, so both systems can be compared
by line. QuickBooks credit memos name no service, so they get a line of their own, "Unallocated credit".
The mapping is in `config/reference.yml`.

### A value that cannot be read stops the pipeline

**Criterion.** Dates and amounts are required: if one does not parse, the export changed and a silent
guess would move the numbers. Values the analysis can work without (a contract's annual value or
auto-renewal, a customer's account manager) are kept as unknown when empty.

## Who is who

### Names match on a normalized key, nothing fuzzier

**Criterion.** Two names are the same company when they are equal once case, punctuation, `&` and a
trailing legal suffix (Inc, LLC, Corp, Ltd) are ignored. A fuzzy match would join "Halloran Academy"
and "Halloran Health Partners", which are different customers. What the rules cannot link is listed, not
guessed.

### Duplicate CRM records are merged when the location matches too

**Criterion.** CRM records with the same normalized name **and** the same city and state are one
customer, billed under both ids. Records that share a name but not the location are kept apart as
possible duplicates. The merged customer takes its id from the oldest record, the name as written
without capitals or a legal suffix, the earliest creation date, and every account manager named on its
records, so a disagreement between them stays visible.

### Shortened names in the notes are accepted when unique

**Criterion.** Account managers often shorten names ("Kessler Surgical"). A note name of two or more
words is linked when exactly one customer's name starts with those words. Shorter or ambiguous names
stay unmatched, and an ambiguous one keeps the customers it fits as candidates. Notes linked to no
customer are shown on the Data screen, because what they say does not reach the risk analysis.

### Ids missing from the CRM are customers of their own

**Criterion.** A customer id billed in NetSuite or named in a contract but missing from the CRM is kept as
a customer of its own, named by its id, rather than dropped or guessed. Names that no rule links (in
QuickBooks or the notes) stay unlinked and are listed.

### A person's decision wins over the rules

**Criterion.** Each rule in `config/assumptions.yml` can be turned off, and single cases can be excepted
from it. Assignments link what no rule can, such as a QuickBooks name to a customer id. Both are applied
before the rules, keyed by values that survive a new export (a CRM id, a name as written), and an entry
that no longer matches anything in the data is reported.
