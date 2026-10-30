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
are mapped to "Credit memos".

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

## Measuring billing

### The measure is net billings, never revenue

**Criterion.** Invoiced amounts that count, net of credit memos, by invoice date. The exports have
invoice dates, not the dates the service was delivered, so the app does not call it revenue. For a
business billed mostly monthly, over three months or more it follows the same trend.

### The fiscal year runs from April to March

**Mechanical.** Set by `fiscalYearStartMonth` in `config/reference.yml`, from the note that came with the
exports. A fiscal year is named by the year it ends in: FY27 runs from April 2026 to March 2027.

### Credit memos are a line of their own

**Criterion.** In the breakdown by service line, every credit memo is reported under "Credit memos",
whatever line the billing system gave it. QuickBooks credit memos have no service line and NetSuite ones
come as inspection; keeping NetSuite's would put credits inside inspection on one side of the system
change and outside it on the other.

### The data runs up to the latest invoice

**Criterion.** The as-of date is the date of the latest invoice. A period counts as complete only once
the as-of date reaches its last day, and a month the as-of date falls in before its end is marked as
partial, so a mid-month export does not look like a drop.

### Every comparison uses two windows

**Criterion.** The last complete fiscal half against the same half a year earlier, because the business
is seasonal and the first half bills more than the second; and the last twelve months against the twelve
before, to show the most recent trend. A comparison is flagged when one side has invoices from QuickBooks
and the other from NetSuite.

### Totals are shown with and without atypical invoices

**Criterion.** Set by `atypicalInvoiceExcludedLines`, `atypicalInvoiceMinimum` and
`atypicalInvoiceMultiple` in `config/assumptions.yml`. An invoice is atypical when its service line is
not inspection or monitoring, it is at least $100k, and it is at least 1.5 times what its customer bills
in an average month (from its first invoice to its last). Inspection and monitoring are billed on a
schedule, so a large one means a large customer, not a one-off. A fixed amount alone would flag routine
work of the largest customers; relative to the customer, it catches one-off projects.

Known limit: the average month covers the customer's whole history, so for a customer that grows steadily
it lags behind its current size. With two and a half years of data the effect is small; with more
history, the average should cover the months before each invoice (see the next steps in the plan).

### The bridge sorts customers by what happened between the two halves

**Criterion.** Stopped: invoiced in the earlier half and not at all in the later one. New: the reverse.
Otherwise billing less or more. Invoices with no customer move together as one more line, so the steps
always add up to the change. Each customer shows how much of its change comes from atypical invoices.

### Open amounts come from NetSuite only

**Criterion.** The share of a period still open when the data was exported is computed from NetSuite,
which keeps collection status up to date. QuickBooks statuses stopped changing at the system change.

## Data findings

### Two kinds of finding: assumptions and observations

**Criterion.** An assumption is a choice of ours that moves the numbers; it says whether Corvane
confirmed it and what reversing it would change. An observation does not move the numbers. Observations
with money involved, or worth checking with Corvane, come before the informative ones.

### The impact of an assumption is measured by reversing it

**Criterion.** The whole pipeline runs again with the rule turned the other way, and one measure is
compared: the change in the half for the invoice rules, the customers that stopped billing for duplicate
customers, the notes linked for shortened names, and the contracts already ended for impossible contract
dates. There is no second copy of the logic that could drift from the first.

### A contract is compared with its value over the time it was in force

**Criterion.** Set by `underBilledContractShare` and `overBilledContractShare` in
`config/assumptions.yml`. What a contract should bill is its annual value prorated over the part of the
last twelve months it was in force; a contract whose end is unknown is taken as still in force. Below
half, it may be work done and not invoiced or a cancellation nobody recorded; above one and a half times,
work beyond the contract or an outdated value. Contracts in force less than three months in that window
are left out.

### A contract that ended is still billing when invoices keep coming

**Criterion.** Set by `stoppedBillingDays` in `config/assumptions.yml`. A customer whose current contract
ended before the as-of date and who has an invoice in the last 90 days is billing without a contract on
file: a month-to-month arrangement or a renewal that was not recorded.

### The jump at the system change is compared with the usual variation

**Criterion.** Billing rose 17% from the last QuickBooks month to the first NetSuite one, which looked
suspicious. It is flagged only if it is larger than every other month-to-month move in the data; the same
month a year later rose 25% with no system change.

### The CRM status is reported, never used

**Criterion.** Where the CRM says active and the customer has not billed in 90 days, or says inactive and
it billed recently, the contradiction is listed. Billing decides whether a customer is active.

## Judging the AI

### Notes are judged on a scale defined by principle

**Criterion.** High: the customer decided, or is acting, to end or reduce the relationship, or the
conflict went beyond the account manager (a formal complaint, a lawyer, a regulator). Medium: a concrete
problem or competitive pressure that can lead there if nobody acts. Low: minor or resolved friction.
None: routine or positive. Defined by what each level means rather than by a list of cases from these
notes, so it holds for notes nobody has seen yet. A person labeling and the LLM use the same scale, along
with the reasons (service, price, competitor, billing, other) and the note type (customer, internal,
prospect). It is a business definition: Corvane's account managers should validate it.

Known limit: the scale does not say outright that a customer escalating to its own senior management, or
demanding credits or a remediation plan, has taken the conflict beyond the account manager. The LLM reads
those notes as medium where the hand labels say high. There are three such notes, and reading all three
as high changes no customer's place in the worklist: two belong to customers with other high notes, and
the third customer is already at high risk from a medium note and a strong billing decline. Refining the
prompts over rounds of hand review, this definition among them, is a next step.

### The labeled sample is stratified by a keyword screen

**Criterion.** A plain random sample would hold few notes with risk, too few to tell how many the LLM
finds. The notes are split by a generic list of words that often come with risk (terminate, competitor,
missed, dispute...), and 20 are drawn at random from each group with a fixed seed. Scores are weighted
back by the size of each group, so they still describe all the notes. Nothing in the method depends on
how these notes were written, so it works on any CRM; and it does not depend on the LLM, so the sample is
drawn and labeled before the LLM runs.

### Labels are set by a person, before the LLM runs

**Criterion.** An LLM checking another LLM is not an independent check, and a person who has seen the
LLM's answer tends to agree with it. The labels are set by hand, without the group each note was drawn
from, before the classifier exists. A label off the scale stops the evaluation instead of counting as a
wrong answer.

### The LLM reads one note at a time

**Criterion.** Each call gets one note, as written, without the customer's other notes or numbers. Every
answer can then be checked against the note it came from, and scored against a label. Putting a
customer's notes together, in order and with its billing, is the job of the customer story.

### Every risk comes with a quote found in the note

**Criterion.** The LLM has to quote the part of the note that justifies the risk it gives. The quote is
checked in code: it must appear in the note, ignoring only case, spacing and quotation marks. A risk
without a quote found in the note is reported as a failure.

### Answers are cached, not versioned

**Mechanical.** Each answer is stored under a key made of the prompt version, the model and the exact
text sent. Running again gives the same answers at no cost; changing the prompt, the model or a note asks
again. Like the pipeline output, the answers are not in the repository: a fresh checkout runs `npm run
pipeline` and `npm run llm`, as the first time.

### What matters most is telling notes at risk from the rest

**Criterion.** A note is at risk when it is medium or high. The headline scores are precision (of the
notes the LLM flags, how many are at risk) and recall (of the notes at risk, how many it flags), because
that is what puts a customer on the worklist. The exact level, the reasons and the note type are scored
too, as secondary measures.

### Scores are weighted back to all the notes

**Mechanical.** Each labeled note stands for the notes of its group: 59 / 20 for the keyword group, 204 /
20 for the rest. Weighted counts estimate the scores over all 263 notes; the plain counts in the sample
are reported next to them.

### The LLM has to beat the keyword screen

**Criterion.** The same keyword screen that splits the sample is scored as a classifier: a note is at
risk if it mentions any of its words. If the LLM did not clearly beat it, a list of words would do the
job for less.

### Billing checks the notes without any label

**Criterion.** Customers are grouped by the highest risk their notes show over the last twelve months,
and their billing compared between the two halves. If customers whose notes say high risk did not bill
less, something would be wrong with the reading, whatever the labels say.

### Each report says which model and prompt it measured, and when

**Mechanical.** The model is not fully deterministic, so a fresh `npm run llm` can read a few notes
differently. The report records the model, the prompt version and the date, so its numbers are not
expected to repeat to the decimal.

## Risk and worklist

### A customer stopped billing after 90 days without an invoice

**Criterion.** Set by `stoppedBillingDays` in `config/assumptions.yml`. Customers are billed almost every
month, so 90 days without an invoice is a clear signal; atypical invoices count, since a customer billing
a project is still billing. This is the customer's status today, apart from the bridge, which compares
two closed periods.

### Risk and renewal are two separate dimensions

**Criterion.** Risk says how likely Corvane is to lose the customer; the renewal says when to act: days to
the end of the current contract, whether it ended with no newer contract on file, and whether it renews
by itself. A contract ending soon does not make a healthy customer risky, and a risky customer is not
safe because its contract runs for years. The two only meet in the worklist groups.

### Risk comes from a matrix of the notes and billing, not from points

**Criterion.** Set by `minimumDeclineAmount`, `moderateDeclineShare`, `strongDeclineShare` and
`veryStrongDeclineShare` in `config/assumptions.yml`. One signal is the worst note of the last twelve
months, as the LLM read it (the latest one if several share the level). The other is the decline in
billing, last complete half against the same half a year earlier, without atypical invoices: moderate
from 10%, strong from 25%, very strong from 50%, and only when the drop is at least $10k, so a small
customer's swing does not count.

| Worst note ↓ / Decline → | None | Moderate | Strong | Very strong |
|---|---|---|---|---|
| None, or no notes | none | low | medium | high |
| Low | low | low | medium | high |
| Medium | medium | medium | high | high |
| High | high | high | high | high |

A high note is high risk on its own, and so is a very strong decline, in case the account manager did not
write down what matters. A strong decline with no note behind it is a signal, not a certainty, so it
stops at medium. A matrix instead of a score that adds points explains every level in one line, such as
"Medium note on 2026-05-16 and billing down 43.9% ($27k)".

### The amount at stake is typical billing over a year

**Criterion.** What the customer billed in the last twelve months without atypical invoices, so a one-off
project does not inflate it; for a customer that stopped, the twelve months up to its last invoice.

### Each customer falls in one worklist group, by the first rule that matches

**Criterion.** Set by `winBackMonths`, `actNowRenewalDays` and `upcomingRenewalDays` in
`config/assumptions.yml`. In this order:

1. Stopped billing in the last 12 months → **Win back**.
2. High risk, or medium risk with the contract ending within 90 days or already ended → **Act now**.
3. Medium risk → **Monitor**.
4. Low or no risk with the contract ending within 180 days or already ended → **Renewals**.
5. Low risk → **Monitor**.

The rest, and customers that stopped longer ago, are not in the worklist. Win back is checked first on
purpose: a customer that already left would otherwise fill Act now and hide those that can still be kept.
The groups are shown in another order, Act now, Renewals, Monitor and Win back; within each, by amount at
stake, and renewals by end date, the ended ones first. A renewal with no risk that renews by itself needs
no action and is hidden by default.

Known limit: a contract past its end date counts as ended even when it renews automatically. 13 of the 15
customers billing on an ended contract have auto-renewal, so most of them probably renewed without a new
contract on file. They show as renewals, hidden when healthy, until Corvane says how renewals are
recorded.

### Why a customer stopped is said only as far as the data tells

**Criterion.** Confirmed in the notes when a high-risk note was written in the twelve months before the
last invoice or since; otherwise, contract still in force when its end date has not passed, which may be
work done and not invoiced, or a cancellation nobody recorded; otherwise, unknown.
