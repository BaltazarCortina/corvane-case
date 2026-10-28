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

- **Build once, then read.** A pipeline turns the raw exports into a clean model. It is a pure
  function (`exports + config → model`), runs in well under a second, and its output is what the
  server, the LLM steps and the evaluation all read. The numbers are reproducible and testable.
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
config/*.yml ────┴─► pipeline ──► data/build/   clean model + data findings
                     parse → resolve customers → model → findings
                                │
                                ├─► LLM steps ──► data/llm/   note signals, customer stories
                                │                    └─► eval/   scores against hand labels
                                ▼
                     analysis (billing metrics, risk, worklist)
                                │
                                ▼
                     API (Hono) ──► web (React): Summary · Billing · Worklist · Data
```

Planned layout:

| Path | Contents |
|---|---|
| `config/assumptions.yml` | Our criteria: each assumption with its policy, basis and status, plus business parameters |
| `config/reference.yml` | Mechanical mappings: state and industry spellings, QuickBooks memos to service lines |
| `data/build/` | Pipeline output. Regenerated, not versioned |
| `data/llm/` | LLM output. Versioned, because it costs money to produce |
| `data/raw/` | The exports exactly as received. Never edited |
| `docs/` | This plan and the decisions behind the numbers |
| `eval/` | The hand-labeled note sample |
| `scripts/` | Command line entry points (pipeline, LLM, evaluation) |
| `src/analysis/` | Billing metrics, risk and worklist, computed over the model |
| `src/eval/` | Scoring against hand labels and the keyword baseline |
| `src/llm/` | Note classification and customer stories, with their verifiers |
| `src/pipeline/` | Parsing, customer resolution, the unified model and the data findings |
| `src/server/` | The API |
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
| 3 | Resolve customers | Assumptions config, name normalization, duplicate customers, assignments | |
| 4 | Unified model | One invoice table for both systems, contracts, notes, one record per customer | |
| 5 | Billing metrics | Fiscal calendar, net billings, atypical invoices, two windows, the bridge | |
| 6 | Data findings | Assumptions and observations, impact of each assumption | |
| 7 | Note classification | LLM reading each note, with quote verification | |
| 8 | Evaluation | Hand labels, keyword baseline, cross-check with billing | |
| 9 | Risk and worklist | Risk matrix, renewals, amount at stake, worklist groups | |
| 10 | Customer stories | LLM story per worklist customer, with a citation verifier | |
| 11 | API, app shell, billing screen | Server, React layout, the billing screen | |
| 12 | Worklist and customer panel | The worklist and the customer detail | |
| 13 | Data screen | Data health, reconciliation and AI checks | |
| 14 | Summary screen | The three answers on one screen | |
| 15 | README | How to run it, how it works, AI tools used, next steps | |

**Hand labels.** The note sample for evaluation is drawn and labeled by hand **before stage 7 runs**, so
the labels are not anchored on what the LLM said. The sample and the labels are committed with stage 8.

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

- `config/assumptions.yml`, validated with zod: an unknown value fails with its exact path.
- Name normalization: case, punctuation, `&` and trailing legal suffixes (Inc, LLC, Corp, Ltd). Nothing
  fuzzier: "Halloran Academy" and "Halloran Health Partners" stay distinct.
- Duplicate CRM records: same normalized name **and** same city and state are merged; otherwise they are
  listed as possible duplicates to confirm. The merged customer takes the name without capitals or
  suffix, the earliest created date, and both account managers if they differ.
- QuickBooks names and note names linked to customers; shortened note names accepted only when exactly
  one customer starts with those words (two or more).
- Customer ids billed in NetSuite but missing from the CRM, and QuickBooks names matching no customer:
  explicit assignments in config, with the evidence written next to each one. They take the QuickBooks
  name, so no customer shows as "unknown".
- Manual assignments override rules: if a person decided, that wins.

**Done when:** tests for normalization, merging (including a pair that must not merge), shortened names
and assignments; every CRM record, QuickBooks name, NetSuite id and note name is linked to one customer
or listed as unmatched.

### 4. Unified model

- One invoice table for both systems: every row kept, with its customer, service line, and whether it
  counts or which rule excludes it (duplicate, void). Credit memos count as negative billing in the
  month they are issued.
- Contracts: duplicates once, impossible dates (end before start) leave the end unknown, the latest
  ending contract is the current one.
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
  least 1.5 times the customer's average month. Both values in config.
- Two windows, always: the last complete half against the same half a year earlier, and the last 12
  months against the 12 before. Each total with and without atypical invoices. A flag when a
  comparison crosses the billing system change.
- Breakdown by service line, monthly series, unbilled share (NetSuite only, as of the export date).
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
    variation. The rest are informative: name variants, prospects, unmapped values, the QuickBooks memo
    translation, atypical invoices, customers without an account manager, CRM status contradicting
    billing.
- Impact of each assumption: the pipeline runs again with the alternative policy and compares the
  headline metric, so there is no second copy of the logic to drift.

**Done when:** tests per detector; flipping an invoice assumption changes the period total by exactly the
amount of the rows it affects.

### 7. Note classification

- One LLM call per note, without customer context, so each answer can be checked against its note.
- Output (zod schema): risk level, reasons, note type, a verbatim quote and a one-line summary.
  - Risk, defined by principle: **high** = the customer decided or is acting to end or reduce the
    relationship, or the conflict escalated beyond the account manager (formal complaint, legal,
    regulator); **medium** = a concrete problem or competitive pressure that can lead there if nobody
    acts; **low** = minor or resolved friction; **none** = routine or positive.
  - Reasons (one or more, only with risk): service, price, competitor, billing, other.
  - Note type: customer, internal, prospect.
- Cache keyed by prompt version, model and the exact input; results committed in `data/llm/`.
- Check: every quote must appear verbatim in its note.

**Done when:** every note classified; every quote verbatim.

### 8. Evaluation

- The hand-labeled sample: one note per distinct note template, so every phrasing is covered. Accuracy
  on it measures how each kind of note is handled, not the share of all notes right.
- Scores against the hand labels: exact risk level, precision and recall on "at risk", reasons.
- A keyword baseline scored the same way; where it disagrees with the LLM, the note is reviewed.
- Cross-check with billing: did customers flagged at risk bill less?
- A report in `data/llm/` that the app shows in stage 13.

**Done when:** the report runs from the hand labels; the disagreements have been read.

### 9. Risk and worklist

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
  Shown in the order Act now, Renewals, Monitor, Win back. Healthy auto-renewals hidden by default.
- For those who stopped billing: confirmed in notes / contract still active / reason unknown.

**Done when:** tests for the matrix, the group rules and their order.

### 10. Customer stories

- For customers in Act now, Monitor and Win back that have notes.
- The LLM gets the notes in order plus numbered facts computed by code (billing by service line, the
  two windows, contract, amount at stake, the customer's data findings) and returns trajectory, root
  cause, current state and a suggested next step. Every claim cites notes or facts.
- Mechanical verifier: cited notes and facts exist, numbers in the text appear in the cited sources,
  dates match the cited notes.

**Done when:** tests for the verifier; stories generated and verified.

### 11. API, app shell and billing screen

- Hono API that loads the model and the LLM output at start.
- React app with Vite and Tailwind: layout and navigation.
- Billing screen: the two windows with and without atypical invoices, monthly chart (partial month
  marked), breakdown by service line, the bridge with the customers behind each step. Definitions
  visible.

### 12. Worklist and customer panel

- Worklist: the four groups, owner, reason, amount at stake, contract end; the auto-renewal toggle; why
  customers are at risk (reasons from the notes).
- Customer panel: status and why, contract and the share of its value billed in the last 12 months,
  timeline of notes and monthly billing, the story with readable citations, the data findings that
  touch this customer.

### 13. Data screen

- Status first: do the exports reconcile, how many assumptions await confirmation, the date of the data.
- Pending with Corvane: unconfirmed assumptions with their impact.
- The reconciliation from the exports to the numbers in the app.
- Observations: those worth checking first, the informative ones collapsed. Definitions, including the
  note risk scale.
- How the AI was checked: evaluation scores, quote and story verification results.

### 14. Summary screen

- The three answers on one screen: net billings for the last complete half with and without atypical
  invoices, plus the 12-month line; Act now (customers and amount at stake) with up to ten of them;
  renewals; data status (do the exports reconcile, how many assumptions await confirmation). An
  18-month chart.

### 15. README

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
into typed rows (`src/pipeline/`). Value parsers, reference lookups and each file's rules are tested on
small fixtures; the real exports are checked for three invariants: every line is a parsed row or a known
non-data line, QuickBooks invoices add up to the export's own TOTAL row, and the reference data covers
every value.

Outcome: 175 CRM records, 2,606 QuickBooks invoices (plus a repeated header and the TOTAL row of
$37,389,362.29), 4,170 NetSuite invoices, 155 contracts and 263 notes. Exact duplicates: 45 NetSuite
rows, each on the line right after its original, and 2 contracts. Credit memos: 60 in QuickBooks, 92 in
NetSuite.
