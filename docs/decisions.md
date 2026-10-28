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
