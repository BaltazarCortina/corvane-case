# Build plan

How this prototype is built, in what order and why. Each stage is one commit that can be reviewed on
its own and leaves the project working. When a stage is done, its row in the status table is updated
and its log entry records what was built and how it was checked.

## Goal

Corvane Fire & Safety Services is a ~$40M commercial fire protection business in the Midwest, bought by
a private equity firm in early 2025. Ahead of a quarterly value creation review, its CFO and the
firm's operating partner need answers to three questions, and the prototype is built to answer them:

1. **What is actually happening to revenue?** Corvane grew last fiscal year, but the first half of this
   fiscal year (April to September 2026) may be worse than it looks.
2. **Which customers are we about to lose, and why?** Account managers keep notes on every customer,
   and nobody has time to read two years of them.
3. **Can we trust these numbers?** Billing moved from QuickBooks to NetSuite in April 2025, and the two
   systems were never reconciled.

The answers come from the raw exports of the CRM, both billing systems, the contracts and the account
notes. The prototype runs on localhost: a React app for the CFO on top of a TypeScript backend, with an
LLM reading the account notes.

## Principles

- **Build once, then read.** A pipeline turns the raw exports into a clean model, the billing analysis
  and the data findings. It is a pure function (`exports + config → outputs`), runs in well under a
  second, and its output is what the LLM steps, the evaluation and the server read, including the
  parameters it used: a change to the config shows only once the pipeline runs again, everywhere at once. What is expensive,
  or needs the raw exports, is computed once and saved; what derives cheaply from saved outputs is
  computed by a pure function in the step that needs it, and saved too. The server only reads files,
  so the numbers are reproducible and never change while someone is looking at them.
- **Nothing is dropped silently.** Every invoice is kept and marked: counted, or excluded and by which
  rule. This is what makes the reconciliation and the impact of each assumption possible.
- **Data, mechanical rules and our criteria are kept apart.** Data comes from the exports or the
  client. Mechanical rules transform without judgment (date formats, a TOTAL row). Our criteria are
  choices that could have gone another way, and those are the ones we name, measure and defend.
- **Each business concept is defined once, in one place.** "Stopped billing", "atypical invoice" or
  "amount at stake" are computed by one function and used everywhere.
- **The LLM does what code cannot, and code does the rest.** The LLM reads free text. Totals, periods,
  the risk level and the ranking are code, so "why is this customer first?" has a formula as answer.
- **Generic rules, not case data.** Detectors and rules work on any export with the same structure.
  Customer names, dates or amounts from this dataset appear only in config entries and tests.

## Architecture

```
data/raw/*.csv ──┐
config/*.yml ────┴─► npm run pipeline ──► data/build/   model, billing analysis, data findings, parameters
                     parse → resolve customers → model → billing → findings
                                │
                                ▼
                     npm run llm ──► data/build/   note signals → risk and worklist → customer stories
                                │       └─► npm run eval ──► data/build/   scores against the hand labels in eval/
                                ▼
                     API (Hono) ──► web (React): Summary · Billing · Worklist · Data
```

The code is organized by what it answers, not by the command that runs it: which step computes what is
decided by the entry points in `scripts/`, and moves when a step needs another's output (the worklist
needs the LLM's reading of the notes, so it runs in `npm run llm`). Dependencies point one way: `shared`
is used by everything; `billing` reads the `model`; `findings` and `risk` read both; `stories` reads all
of them; `llm` is infrastructure for `risk` and `stories`; `eval` judges `risk`. `src/build.ts` builds
the model and its billing analysis in one function: the pipeline runs it, and the findings run it again
with each rule reversed.

Layout:

| Path | Contents |
|---|---|
| `config/assumptions.yml` | Our criteria: each assumption with its policy, basis and status, plus business parameters |
| `config/reference.yml` | Mechanical mappings: state and industry spellings, QuickBooks memos to service lines |
| `data/build/` | Everything the steps write: the pipeline, the LLM step and the evaluation. Regenerated, not versioned |
| `data/cache/llm/` | The LLM's answers, kept apart so clearing the outputs does not ask again. Not versioned |
| `data/raw/` | The exports exactly as received. Never edited |
| `docs/` | This plan and the decisions behind the numbers |
| `eval/` | The hand-labeled note sample |
| `scripts/` | Command line entry points (pipeline, LLM, evaluation) |
| `src/billing/` | Net billings: atypical invoices, the two windows, service lines, the bridge |
| `src/build.ts` | The model and its billing analysis from the inputs, in one pure function |
| `src/eval/` | Scoring the LLM's reading of the notes against hand labels and the keyword baseline |
| `src/findings/` | Data findings: assumptions with their impact, and observations |
| `src/llm/` | The LLM provider and the answer cache |
| `src/model/` | Parsing, customer resolution and the unified model |
| `src/risk/` | The note risk scale, the LLM's reading of each note, the risk level and the worklist |
| `src/server/` | The API |
| `src/shared/` | Dates and fiscal periods, money arithmetic, numbers as the app writes them |
| `src/stories/` | Customer stories: the facts they are written from and the citation verifier |
| `tests/` | Unit tests, mirroring `src/`, on small fixtures built for each case |
| `tests/data/` | Invariants on the real exports: totals that must reconcile, rows that must all be accounted for |
| `web/` | The React app |

**Stack:** TypeScript end to end (the data is about 7,000 rows, no dataframe library needed), zod for
config and LLM output schemas, the Vercel AI SDK with OpenAI for the LLM (switching provider is one
line), Hono for the API, React with Vite, Tailwind and Recharts for the web, Vitest for tests and Biome
for lint and format.

## Status

| # | Stage | Includes | Status |
|---|---|---|---|
| 1 | Scaffold | Tooling, raw exports, README and this plan | Done |
| 2 | Parse the exports | Typed rows from the five files, reference mappings | Done |
| 3 | Resolve customers | Assumptions config, name normalization, duplicate customers, assignments | Done |
| 4 | Unified model | One invoice table for both systems, contracts, notes, one record per customer | Done |
| 5 | Billing metrics | Fiscal calendar, net billings, atypical invoices, two windows, the bridge | Done |
| 6 | Data findings | Assumptions and observations, impact of each assumption | Done |
| 7 | Evaluation set | Keyword screen, stratified sample of notes, hand labels || Done |
| 8 | Note classification | LLM reading each note, with quote verification || Done |
| 9 | Evaluation | Scores against the hand labels, keyword baseline, cross-check with billing || Done |
| 10 | Risk and worklist | Risk matrix, renewals, amount at stake, worklist groups | Done |
| 11 | Customer stories | LLM story per worklist customer, with a citation verifier | Done |
| 12 | API, app shell, billing screen | Server, React layout, the billing screen | Done |
| 13 | Worklist and customer panel | The worklist and the customer detail | |
| 14 | Data screen | Data health, reconciliation and AI checks | |
| 15 | Summary screen | The three answers on one screen | |
| 16 | Fine-tuning | Manual assignments and exceptions for single cases | |
| 17 | README | How to run it, how it works, AI tools used, next steps | |

**Evaluation first.** The set the LLM is judged against (stage 7) is drawn and labeled by hand before the
classifier runs (stage 8), so the labels are not anchored on what the LLM said.

## Stages

Every stage ends with `npm run verify` (lint, typecheck, tests) passing. A stage is done when its rules
are tested on small fixtures built for each case, and when invariants hold on the real data (totals that
must reconcile, rows that must all be accounted for). The resulting numbers are recorded in the log, as
an outcome, not as a target. The choices a stage makes are added to [decisions.md](decisions.md).

### 1. Scaffold

- Project tooling: TypeScript, Biome, Vitest, npm scripts (`check`, `fix`, `typecheck`, `test`,
  `verify`).
- The raw exports in `data/raw/`, exactly as received.
- README and this plan.

**Done when:** `npm run verify` passes.

### 2. Parse the exports

- Read the five CSV files into typed rows. Mechanical rules only:
  - dates in three formats (`2024-04-01`, `04/01/2024`, `Apr 01, 2024`), month first;
  - amounts with `$`, thousands separators and parentheses for negatives;
  - the QuickBooks TOTAL row and repeated header are recognized and set aside, not parsed as invoices;
  - text variants (`Monthly`/`monthly`, `Yes`/`yes`) unified;
  - exact duplicate rows marked, not removed.
- `config/reference.yml`: state and industry spellings, QuickBooks memos to NetSuite service lines.
  Values with no mapping are reported, not dropped.

**Done when:** tests cover each rule; parsed QuickBooks invoices sum exactly to the export's own TOTAL
row; every line of every file is either a parsed row or a recognized non-data line.

### 3. Resolve customers

- `config/assumptions.yml`, validated with zod: an unknown value fails with its exact path. Each
  assumption is a rule that can be turned off, with exceptions for single cases and assignments for
  links no rule can make. Only the general rules are set here; single cases come in stage 16.
- Name normalization: case, punctuation, `&` and trailing legal suffixes (Inc, LLC, Corp, Ltd). Nothing
  fuzzier: "Halloran Academy" and "Halloran Health Partners" stay distinct.
- Duplicate CRM records: same normalized name **and** same city and state are merged; otherwise they are
  listed as possible duplicates to confirm. The merged customer takes the name without capitals or
  suffix, the earliest created date, and both account managers if they differ.
- QuickBooks names and note names linked to customers; shortened note names accepted only when exactly
  one customer starts with those words (two or more).
- Customer ids billed in NetSuite but missing from the CRM become customers of their own; names no rule
  links are listed as unmatched.
- Assignments and exceptions are applied before the rules: if a person decided, that wins.

**Done when:** tests for normalization, merging (including a pair that must not merge), shortened names
and assignments; every CRM record, QuickBooks name, NetSuite id and note name is linked to one customer
or listed as unmatched.

### 4. Unified model

- One invoice table for both systems: every row kept, with its customer, service line, and whether it
  counts or which rule excludes it (duplicate, void). Credit memos count as negative billing in the
  month they are issued.
- Contracts: duplicates once, impossible dates (end before start) leave the end unknown, the contract
  that started last is the current one.
- Notes linked to customers; unmatched notes kept.
- One record per customer: identity, aliases, account managers, contract, invoices, notes.
- `npm run pipeline` writes `data/build/` and prints a short summary.

**Done when:** every invoice has a customer or is listed as unassigned; the export totals reconcile to
the counted total, rule by rule, to the cent.

### 5. Billing metrics

- Fiscal calendar as functions (fiscal year April to March, named by the year it ends: FY27 ends March
  2027). As-of date is the latest invoice; the last month is partial if it ends before month end.
- The measure is **net billings**: invoiced, net of credit memos, by invoice date. Never called revenue.
- Atypical invoices, relative to the customer: not inspection or monitoring, at least $100k, and at
  least 1.5 times the customer's average month. The excluded lines and both thresholds in config.
- Two windows, always: the last complete half against the same half a year earlier, and the last 12
  months against the 12 before. Each total with and without atypical invoices. A flag when a
  comparison crosses the billing system change.
- Breakdown by service line, with credit memos as a line of their own; monthly series; unbilled share
  (NetSuite only, as of the export date).
- The bridge between the two halves: customers that stopped billing (billed in the earlier period,
  nothing in the later), billing less, billing more, new. Each step lists its customers and how much of
  the change is atypical invoices.

**Done when:** tests for the calendar, the atypical rule and the windows; the bridge steps add up exactly
to the change between the two periods.

### 6. Data findings

- Generic detectors, each producing a group of cases with a business-language summary. Two kinds,
  depending on whether they move the numbers:
  - **Assumptions** move them: a criterion we chose, with its impact and whether Corvane confirmed it
    (duplicate invoices, voided invoices, credit memos, duplicate customers, shortened names,
    assignments, impossible contract dates).
  - **Observations** do not. Those with money involved or worth checking with Corvane come first:
    active contracts billing under 50% of their value, expired contracts still billing, customers billing
    well above their contract, and whether billing at the system change is within normal month-to-month
    variation, and notes linked to no customer, with the reason (no customer fits the name, or the
    candidates it fits), since their content does not reach the risk analysis. The rest are
    informative: name variants, unmapped values, the QuickBooks memo translation, atypical invoices,
    customers without an account manager, CRM status contradicting billing.
- Impact of each assumption: the pipeline runs again with the rule reversed and compares one measure
  chosen per assumption, so there is no second copy of the logic to drift.

**Done when:** tests per detector; flipping an invoice assumption changes the period total by exactly the
amount of the rows it affects.

### 7. Evaluation set

- A keyword screen: a generic list of words that often come with a customer at risk (terminate,
  competitor, missed, dispute...), written for any account notes, not for these.
- The hand-labeled sample, drawn in a way that works on any CRM: the notes are split by the keyword
  screen, and 20 are drawn at random from each group with a fixed seed. A plain random sample would
  hold too few notes with risk to measure how many the LLM finds.
- The labels, set by hand before the classifier runs, following the risk scale of stage 8: risk level,
  reasons and note type. Instructions in `eval/README.md`.

**Done when:** tests show the sample is reproducible and drawn from both groups; every note in the
sample has a valid label.

### 8. Note classification

- One LLM call per note, without customer context, so each answer can be checked against its note.
- Output (zod schema): risk level, reasons, note type, a verbatim quote and a one-line summary.
  - Risk, defined by principle: **high** = the customer decided or is acting to end or reduce the
    relationship, or the conflict escalated beyond the account manager (formal complaint, legal,
    regulator); **medium** = a concrete problem or competitive pressure that can lead there if nobody
    acts; **low** = minor or resolved friction; **none** = routine or positive.
  - Reasons (one or more, only with risk): service, price, competitor, billing, other.
  - Note type: customer, internal, prospect.
- Cache keyed by prompt version, model and the exact input; results written to `data/build/`.
- Check: every quote must appear verbatim in its note.

**Done when:** every note classified; every quote verbatim.

### 9. Evaluation

- Scores against the hand labels: exact risk level, precision and recall on "at risk", reasons.
  Reported per group of the sample and weighted back by the size of each group.
- The keyword screen as a baseline, scored the same way; where it disagrees with the LLM, the note is
  reviewed.
- Cross-check with billing: did customers flagged at risk bill less?
- A report in `data/build/` that the app shows in stage 14.

**Done when:** the report runs from the hand labels; the disagreements have been read.

### 10. Risk and worklist

- Current status: no invoice in 90 days means the customer stopped billing.
- Two separate dimensions:
  - **Risk** (how likely we lose the customer), from a matrix of the worst note in the last 12 months
    and the billing decline (last complete half against a year earlier, without atypical invoices,
    with a $10k floor): moderate 10–25%, strong 25–50%, very strong 50% or more. A high note alone, or a
    very strong decline alone, is high risk. Each level comes with a one-line reason.
  - **Renewal** (when to act): days to contract end, expired without a renewal on file, auto-renew.
- Amount at stake: the last 12 months of billing without atypical invoices (the 12 months before
  leaving, for those who stopped).
- Worklist groups, assigned by the first rule that matches: stopped billing in the last 12 months →
  **Win back**; high risk, or medium risk ending within 90 days or expired → **Act now**; medium risk →
  **Monitor**; low or no risk ending within 180 days or expired → **Renewals**; low risk → **Monitor**.
  Shown in the order Act now, Renewals, Monitor, Win back; within each group by amount at stake, and
  renewals by end date. Healthy auto-renewals hidden by default.
- For those who stopped billing: confirmed in notes / contract still active / reason unknown.
- Computed in the LLM step, right after the note signals it needs, and saved with them, so the
  customer stories and the server read the same worklist.

**Done when:** tests for the matrix, the group rules and their order; the escalation notes the LLM
reads as medium (stage 9) do not change any customer's group.

### 11. Customer stories

- For customers in Act now, Monitor and Win back that have notes.
- The LLM gets the notes in order plus numbered facts computed by code (billing by service line, the
  two windows, contract, amount at stake, the customer's data findings) and returns trajectory, root
  cause, current state and a suggested next step. Every claim cites notes or facts.
- Mechanical verifier: cited notes and facts exist, numbers in the text appear in the cited sources,
  dates match the cited notes.

**Done when:** tests for the verifier; stories generated and verified.

### 12. API, app shell and billing screen

- Hono API that reads the files in `data/build/` and serves them; it computes nothing.
- React app with Vite and Tailwind: layout and navigation.
- Billing screen: the two windows with and without atypical invoices, monthly chart (partial month
  marked), breakdown by service line, the bridge with the customers behind each step. Definitions
  visible.

### 13. Worklist and customer panel

- Worklist: the four groups, owner, reason, amount at stake, contract end; the auto-renewal toggle; why
  customers are at risk (reasons from the notes).
- Customer panel: status and why, contract and the share of its value billed in the last 12 months,
  timeline of notes and monthly billing, the story with readable citations, the data findings that
  touch this customer.

### 14. Data screen

- Status first: do the exports reconcile, how many assumptions await confirmation, the date of the data.
- Pending with Corvane: unconfirmed assumptions with their impact.
- The reconciliation from the exports to the numbers in the app.
- Observations: those worth checking first, the informative ones collapsed. Notes linked to no customer
  are split into prospects (by the note type the LLM reads in stage 8) and names still to resolve, each
  with its risk level. Definitions, including the note risk scale.
- The money a customer's case involves (expired contracts still billing, customers without an account
  manager) is its amount at stake, the same the worklist shows. Today the findings use the billing of the
  last twelve months, which matches it except for customers that stopped billing, where it undersells
  them (two cases: $11k instead of $220k, $150k instead of $221k). The amount at stake moves to
  `src/billing/` and both use it; only those amounts in `findings.json` change.
- How the AI was checked: evaluation scores, quote and story verification results.

### 15. Summary screen

- The three answers on one screen: net billings for the last complete half with and without atypical
  invoices, plus the 12-month line; Act now (customers and amount at stake) with up to ten of them;
  renewals; data status (do the exports reconcile, how many assumptions await confirmation). An
  18-month chart.

### 16. Fine-tuning

- With the whole system visible, the single cases the rules cannot settle are decided by hand in
  `config/assumptions.yml`: assignments with their evidence (QuickBooks names that match no customer,
  paired with ids missing from the CRM by monthly amount, service mix and contract dates) and
  exceptions where a rule should not apply.
- Each one shows its impact on the Data screen like any other assumption.

### 17. README

- How to run it, how it works, the AI feature and how it is verified, the AI tools used and for what,
  and the next steps.

## Next steps

**Extras,** only once every stage above works end to end, each as its own commit:

- A support check on customer stories: one LLM call per story that reviews each claim against the
  sources it cites.
- A simple period selector on the billing screen (quarter, half, fiscal year).
- Token usage recorded per LLM call and shown with the AI checks.
- A full customer list.

**Further iterations,** not built in this prototype:

- Ongoing evaluation: label a few new notes at random every week, so the measured accuracy follows the
  notes as they change, instead of resting on a single sample.
- Refine the prompts, for the notes and for the customer stories, over several rounds of hand review:
  compare what the LLM says with what a person says, find where they part and why, fix the definition
  rather than the example, and measure again on notes not used before (a sample used to find a gap
  overstates the scores once the prompt is fixed for it). One gap already known: the scale does not say
  outright that a customer escalating to its senior management, or demanding credits or a remediation
  plan, is high risk, and the LLM reads those notes as medium.
- Atypical invoices measured against the customer's average month before each invoice (the previous 6
  or 12 months) instead of its whole history, so a customer that grows steadily is compared with its
  current size. Small effect with two and a half years of data; it grows with every export added.
- Full period and comparison selectors.
- Editing assumptions from the app, and live reload when the config changes.
- A warning when a customer story is out of date with its inputs.
- LLM-assisted matching of customer records across systems, always confirmed by a person.
- Live integration with NetSuite and Salesforce instead of file exports.
- Scale: a database for the clean model, incremental builds, batched LLM calls.

## Log

### 1. Scaffold

Built the tooling, copied the exports and wrote this plan. `npm run verify` passes (no tests yet).

### 2. Parse the exports

Each export is read with its line numbers and checked for the columns the pipeline uses, then parsed
into typed rows (`src/model/`). Value parsers, reference lookups and each file's rules are tested on
small fixtures; the real exports are checked for three invariants: every line is a parsed row or a known
non-data line, QuickBooks invoices add up to the export's own TOTAL row, and the reference data covers
every value.

Outcome: 175 CRM records, 2,606 QuickBooks invoices (plus a repeated header and the TOTAL row of
$37,389,362.29), 4,170 NetSuite invoices, 155 contracts and 263 notes. Exact duplicates: 45 NetSuite
rows, each on the line right after its original, and 2 contracts. Credit memos: 60 in QuickBooks, 92 in
NetSuite.

### 3. Resolve customers

`config/assumptions.yml` holds the first two rules (duplicate customers and shortened note names), each
with `applies`, `confirmed`, `basis` and optional exceptions, plus a list of manual assignments, empty
for now. It is validated with zod: a wrong type, a missing field or a misspelled key fails with its path.
`src/model/resolve.ts` builds the customers and links every id and name to one of them, in this
order: assignments, exact names, normalized names and, for notes only, unique shortened names. Rules,
exceptions and assignments are tested on fixtures, including names that must not match ("Halloran
Academy" against "Halloran Health Partners") and an ambiguous shortened name. On the real data, every id
belongs to a customer, every name is linked or listed as unmatched, and every config entry points to
something in the data.

Outcome: 170 customers, 4 of them outside the CRM. 9 groups of duplicate CRM records, all in the same
location and merged; 2 of them name different account managers. 187 of 191 QuickBooks names linked (147
exact, 40 normalized); the other 4 match no customer. 141 of 145 note names linked (112 exact, 16
normalized, 13 shortened, covering 15 notes). 4 stay unmatched: 3 prospect meetings and "Evanston
Row", which fits two customers and keeps both as candidates.

### 4. Unified model

Four more rules in `config/assumptions.yml`: duplicate invoices, voided invoices, credit memos and
impossible contract dates. `src/model/model.ts` puts the invoices of both systems in one table, each
with its customer and either counted or excluded by the first rule that applies; links contracts and
notes; gives each customer the names and ids it appears under and its current contract; and reconciles
each export from its total to the counted one, rule by rule. `src/model/build.ts` chains parse,
resolve and model into one function, and `npm run pipeline` writes `data/build/model.json` with a
summary. Each rule, its exceptions and turning it off are tested on fixtures; on the real data, each
export reconciles to the cent, the QuickBooks total matches its TOTAL row, and every invoice and
contract points to an existing customer or is counted as unassigned.

Outcome: QuickBooks $37,389,362.29 in 2,606 rows, all counted; 64 rows ($641,756.27) unassigned, from the
4 names that match no customer. NetSuite $62,056,789.79 in 4,170 rows: 45 duplicates ($801,407.19) and 67
voided ($1,112,279.96) excluded, $60,143,102.64 counted in 4,058 rows. 155 contracts: 2 duplicates and 6
with an unknown end; no customer has more than one contract, 17 have none. 4 notes linked to no
customer.

### 5. Billing metrics

`src/billing/` computes billing over the model, on the periods of `src/shared/calendar.ts` (fiscal
years and halves, the two windows, as functions of the fiscal year's start month in
`config/reference.yml`): `billing.ts` (the invoices that count, each marked atypical or not with the
parameters in `config/assumptions.yml`; totals and changes per window; service lines; the monthly series;
the open share), `bridge.ts` (the bridge between two periods) and `analyze.ts`, which puts it all
together; `src/build.ts` builds the model and its billing analysis from the inputs in one function. Each
rule is tested on fixtures (complete and partial periods, a calendar-year fiscal year, the atypical thresholds, the bridge kinds);
on the real data, both windows compare complete periods, the bridge adds up to the cent and matches the
half totals, the service lines add up to the totals, and the months add up to everything counted.

Outcome: data as of 2026-09-30. H1 FY27 against H1 FY26: $21.07M to $19.64M (−6.8%); without atypical
invoices, $20.88M to $19.10M (−8.5%). Twelve months to September 2026 against the twelve before: +0.8%,
and −1.2% without atypical invoices; this comparison crosses the system change. 5 atypical invoices, all
projects. By line, inspection fell from $13.03M to $12.24M and monitoring from $3.50M to $3.05M; credit
memos went from −$0.09M to −$0.13M. The bridge: 8 customers stopped (−$1.25M), 74 billed less (−$2.62M), 69 more (+$2.06M) and 8
are new (+$0.38M). 12% of H1 FY27 billing was still open at the export date.

### 6. Data findings

Three more parameters in `config/assumptions.yml`: the days without an invoice that mean a customer
stopped billing, and the shares of its value below and above which a contract is worth checking.
`src/findings/findings.ts` turns each rule into an assumption finding, with the cases it affects and its
impact, measured by running everything again with the rule reversed; `src/findings/observations.ts`
detects the observations. Each finding has a business-language summary and its cases. The detectors are
tested on a small dataset built to trigger each one; on the real data, reversing each invoice rule moves
the half total by exactly the invoices it affects, every assumption names its rule and impact, and every
case points to an existing customer. `npm run pipeline` now saves the billing analysis and the findings
next to the model, so the server will only read files.

Outcome: 6 assumptions. Duplicate invoices: 45 ($801k), reversed the half would read −3.0% instead of
−6.8%. Voided: 67 ($1.1M), −6.2%. Credit memos: 150 (−$518k), −6.5%. Duplicate customers: 9 companies,
billed under both ids in at most 4 of 18 months; kept apart, 9 customers would look like they stopped
billing instead of 8. Shortened names: 13, linking 15 notes. Impossible contract dates: 6, taken as
exported 23 current contracts would look ended instead of 17. Worth checking: 9 contracts billed under
half their value ($1.4M short), 6 customers billed over 1.5 times their contract, 15 expired contracts
still billing, 4 notes linked to no customer. The jump at the system change (+16.9%) is within the usual
variation (−26.7% to +25.0%). Informative: 56 name variants, 20 QuickBooks memos, 5 atypical invoices, 15
customers without an account manager, 7 CRM statuses contradicting billing.

### 7. Evaluation set

`src/risk/scale.ts` defines the scale a note is judged on, shared by the labels and the LLM.
`src/eval/keywords.ts` is the keyword screen; `src/eval/sample.ts` draws 20 notes at random from each
group it makes, with a fixed seed; `npm run eval:sample` writes them to `eval/label-sample.csv`, without
the group, for labeling as `eval/labels.csv` (instructions in `eval/README.md`). `src/eval/labels.ts`
reads the labels and fails on a value off the scale. Tests cover the screen, the draw (same seed, same
sample, whatever the order of the notes; another seed, another sample; groups smaller than the sample)
and the label checks; on the real data, the labels cover exactly the sample.

Outcome: the screen flags 59 of the 263 notes. The sample has 40 notes, 20 from each group, with 24
distinct texts once names are left aside. Labeled by hand: 27 none, 2 low, 8 medium and 3 high; reasons
mostly service (10), then price and competitor (2 each); 38 customer notes, 1 internal and 1 prospect.
A review against the written scale made two kinds of note consistent before the LLM ran: asking for a
competitor's quote is competitive pressure (medium), and a deficiency list is repairs found on the
customer's equipment, not a service failure (none). The fire marshal citations stay medium, with a
comment that high is also defensible.

### 8. Note classification

`src/risk/notes.ts` sends each note on its own to the LLM, with the scale of stage 7 in the instructions,
and gets back a risk level, reasons, a note type, a quote and a one-line summary, validated with zod.
The quote is checked in code against the note. `src/llm/provider.ts` is the only file that knows the
provider (OpenAI, through the Vercel AI SDK); `src/llm/cache.ts` keeps each answer under a key of
prompt version, model and input. `npm run llm` runs it over every note, eight at a time, and writes
`data/build/note-signals.json`. Tests cover the quote check and the clean-up of answers without calling
the LLM; on the real data, every note has one signal, every risk has a quote found in its note, and
reasons come only with risk.

Outcome: 263 notes read by `gpt-6-luna` in about 70 seconds. 198 none, 21 low, 30 medium and 14 high;
every quote found in its note. 3 notes typed as prospects, the same 3 that no customer could be found
for; 2 internal. Among the high ones, three are fire marshal citations, the case the hand labels left as
medium with a comment.

### 9. Evaluation

`src/eval/score.ts` scores readings against the hand labels, each labeled note weighted by the notes of
its group it stands for; `src/eval/evaluate.ts` builds the report: the LLM against the labels, the
keyword screen as a baseline, the confusion between levels, every disagreement, and the billing check,
which groups customers by the highest risk in their notes (`src/risk/noteRisk.ts`) and compares
their billing between the two halves. `npm run eval` writes `data/build/eval-report.json` with the model,
prompt version and date. Tests cover the weighting, the scores and the highest risk per customer; on the
real data, every labeled note is scored and the groups add up to all the notes.

Outcome, `gpt-6-luna` with prompt `notes-1`: the LLM got every note in the sample right on whether it is
at risk (11 at risk, no false alarms, none missed), so precision and recall are 100%, weighted or not;
same level on 88% of the notes, same note type on all, and the same reasons on every note at risk. The
keyword screen reaches 50% precision and 74% recall. With 11 notes at risk in the sample, 100% means no
miss was seen, not that there are none.

The 6 disagreements were read; all are one level apart on the same side of at risk. Two deficiency lists
the labels call none and the LLM low. Two escalations to the customer's own VP with a demand for credits,
high in the labels and medium for the LLM: the scale does not say outright that this is beyond the
account manager. All three notes of this kind in the data read as medium; two belong to customers with
other high notes, and the third (Wexford Commercial Properties) is checked in stage 10. The prompt is
left as it is in the prototype; refining the prompts over rounds of hand review is a next step. Two fire
marshal citations, medium in the labels and high for the LLM, the case the labels already marked as
arguable.

Billing check: the 9 customers whose notes say high risk bill a median 91% less, all of them less; the
6 at medium, 6% less, two thirds of them less; customers at low or none bill a few percent more. The 64
customers with no notes in the period bill a median 6% less: the notes do not see everything, which is
why billing has its own weight in the risk level.

### 10. Risk and worklist

Seven more parameters in `config/assumptions.yml`: the minimum drop and the three shares that grade a
billing decline, the two renewal horizons and the months a lost customer is worth winning back, checked
to be in order. `src/risk/risk.ts` grades the decline and combines it with the worst note in a matrix,
with a one-line reason per level; `src/risk/worklist.ts` gives every customer its billing status,
risk, renewal, amount at stake and, for those that stopped, why, and places it in a group by the first
rule that matches. `npm run llm` builds it right after the note signals and writes
`data/build/worklist.json`, in the order it is shown. Tests cover the matrix, the decline thresholds and
minimum, each group rule and their order, the amount at stake before and after stopping, the reasons for
stopping and the display order; on the real data, every customer is assessed once, every customer at
high risk that still bills is in Act now, and reading the three escalation notes as high, as the hand
labels do, leaves every customer in the same group.

Outcome: of 170 customers, 146 bill, 17 stopped and 7 never billed. Among those billing, 5 are at high
risk, 19 medium, 27 low and 95 none; 3 of the high ones have no high note (two very strong declines, and
a medium note with a strong decline). The worklist: Act now 14 ($5.2M at stake, 5 high and 9 medium);
Renewals 30, 19 of them healthy auto-renewals hidden by default; Monitor 28 (10 medium, 18 low); Win
back 12 ($3.7M), 7 confirmed in the notes, 4 with the contract still in force and 1 unknown. 5 more
stopped over a year ago and are left out. Wexford Commercial Properties, one of the escalations, is in
Act now with or without it, from a medium note and a 43.9% decline. 13 of the 15 customers billing on
an ended contract have auto-renewal: a question for Corvane on how renewals are recorded.

### 11. Customer stories

`src/stories/facts.ts` computes the numbered facts of a customer: profile, billing status, risk, contract,
amount at stake, both windows, service lines, months and its data findings, with amounts written the way
the app writes them. `src/stories/stories.ts` picks the customers that get a story and sends the LLM their
facts and notes, oldest first; the answer is a headline, a trajectory, and the root cause, current state
and suggested next step, each citing facts and notes. `src/stories/verify.ts` checks every citation, amount,
percentage and date against what the claim cites. `npm run llm` writes the stories, each with its facts
and its check, to `data/build/stories.json`. Tests cover the verifier (missing and unknown citations,
numbers and dates not in the cited sources, the headline), the choice of customers, the order of the
notes and the facts; on the real data, there is one story per customer that needs one, written from the
current facts and notes, and each carries the result the verifier gives today.

Outcome: 42 stories, written by `gpt-6-luna` in about 70 seconds: 20 worsening, 12 lost, 7 improving and
3 stable. All 42 pass every check: 423 citations, 97 amounts and percentages and 109 dates, each found in
what it cites. Read by hand, the stories keep to their sources. Four customers gave their reason in a
written non-renewal notice, and the story states it as theirs. Where the notes show a sequence instead,
such as renewal pricing above a competing quote and then the customer moving to that competitor, the
story describes it as what the notes show. Where the notes record no problem, as for a customer that
stopped billing with its contract in force and whose only recent note is about a monitoring transfer, the
story says so; and stories flag where the data may explain the billing. What the verifier cannot see is
whether a source supports the conclusion drawn from it, which is the support check in the extras.

### 12. API, app shell and billing screen

`src/server/app.ts` is a Hono API that serves the files in `data/build/` as they are, the model in parts
(customers, contracts, notes, reconciliation) because it is too large to send whole, and the parameters
the pipeline used, for the definitions. It reads the files on every request and computes nothing;
a missing file answers with the command that writes it. `web/` is the React app, with Vite and Tailwind:
a header with the screens, each at its own address. The billing screen answers first and opens detail on
demand, so it fits in about a screen and a half: the last complete half as the main figure and the last
twelve months beside it, each with and without atypical invoices, with the open share and a flag when a
comparison crosses the system change; one chart with two views, billing by month (typical and atypical
stacked, the two halves compared shaded, the system change marked, a partial month faded, a table view)
and the service lines in both halves; and the bridge as a list and its detail, the steps as bars growing
left or right from zero and the customers behind the selected one, with the largest step selected from
the start. Only the terms that are not obvious to someone in the trade have a definition, next to the
term: net billings, atypical invoices, the fiscal half and the bridge steps, with the thresholds the
numbers were built with. The app formats numbers with the same functions as the pipeline. `npm run dev`
starts both. Tests cover the API: a file served as it is, a part of the model, the message for a missing
file, an unknown resource and the parameters.

Outcome: the screen shows H1 FY27 at $19.6M, −6.8% against $21.1M (−8.5% without atypical invoices), 12%
still open; the last twelve months at $39.1M, +0.8% (−1.2%), flagged as crossing the system change; the 5
atypical invoices visible on top of their months; and the bridge from $21.1M to $19.6M, opening on the 74
customers that billed less (−$2.6M).

