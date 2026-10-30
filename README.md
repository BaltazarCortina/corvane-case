# Corvane: billing, customers at risk and data health

A prototype that helps Corvane Fire & Safety Services and its private equity owner answer three
questions: what is actually happening to revenue, which customers they are about to lose and why, and
whether the numbers can be trusted. It reads the raw exports (the CRM, QuickBooks, NetSuite, the
contracts and the account notes) and runs on localhost: a React app on top of a TypeScript backend, with
an LLM reading the account notes.

How it was built, stage by stage, is in [docs/plan.md](docs/plan.md); every choice behind the numbers,
and why, is in [docs/decisions.md](docs/decisions.md).

## What it shows

- **Summary.** Net billings for the last complete half (H1 FY27, −6.8% against H1 FY26) and why they
  moved, the customers to act on now and what to know about them, the last 18 months by quarter.
- **Billing.** The half and the last twelve months, with and without atypical invoices; billing by month
  and by service line; the bridge from one half to the next, with the customers behind each step.
- **Worklist.** Who to call and why, in four groups (Act now, Renewals, Monitor, Win back), with the
  owner, the risk level and its reason, the amount at stake and the contract. A customer opens in a
  panel with its story, its notes and the data findings that touch it.
- **Data.** What the numbers can be relied on for and where the data may be wrong; the questions only
  Corvane can answer; the assumptions we decided on the evidence, each with what the numbers would be
  the other way.

## Run it

Requires Node 22 or later, and an OpenAI API key for the LLM step.

```bash
npm install
cp .env.example .env   # then set OPENAI_API_KEY
npm run pipeline       # the model, billing analysis and data findings, from data/raw into data/build
npm run llm            # read the notes, build the worklist and write the customer stories into data/build
npm run dev            # the API on port 3001 and the app on http://localhost:5173
```

The first `npm run llm` asks the LLM about 263 notes and writes 42 stories, a few minutes in all. Every
answer is cached in `data/cache/llm`, so running it again costs nothing unless a note, a prompt or the
model changes. Nothing the steps write is versioned: a fresh checkout runs both steps, as the first time.

## How it works

```
data/raw/*.csv ──┐
config/*.yml ────┴─► npm run pipeline ──► model, billing analysis, data findings
                                │
                                ▼
                     npm run llm ──► note signals → risk and worklist → customer stories
                                │
                                ▼
                     API (Hono) ──► web (React): Summary · Billing · Worklist · Data
```

- **Build once, then read.** The pipeline is a pure function from the exports and the config to the
  outputs, and runs in under a second. The LLM step reads its output; the server only serves files.
  The numbers on screen are exactly what was built and tested.
- **Nothing is dropped silently.** Every invoice row is kept and marked: counted, or set aside by a named
  rule. Every name and id is linked to a customer or listed as unlinked.
- **Our criteria are named, measured and configurable.** Where the data allows more than one reading
  (duplicate rows, voided invoices, credit memos, duplicate CRM records, contracts that end before they
  start), the rule we chose lives in `config/assumptions.yml` with its basis and status. The pipeline
  runs again with each rule reversed to show what it changes: counting the July duplicates as real
  charges would turn H1 from −6.8% into −3.0%.
- **The LLM does what code cannot.** It reads the notes and writes the stories. Totals, periods, the
  risk level and the worklist are code, so "why is this customer first?" has a formula as its answer.

## Data issues

Fixed, because they change the answers:

- 45 exact duplicate invoices ($801k, all in July 2026) and 67 voided invoices ($1.1M) do not count;
  credit memos count, net.
- 9 companies with two CRM records are one customer each; names written differently across the files
  (case, punctuation, legal suffixes, shortened names in the notes) are linked to their customer.
- 6 contracts that end before they start are taken as having an unknown end, not as expired.
- 5 atypical invoices ($1.7M, one-off projects) are shown apart, so they neither hide nor fake a trend.

Found and set aside, each listed on the Data screen:

- 4 QuickBooks names ($642k, until March 2025) match no customer, and 4 ids billing in NetSuite since
  April 2025 are not in the CRM. They look like the same customers seen from each system; they stay
  apart until Corvane confirms.
- 8 contracts in force billed $1.3M below their value, and 15 customers keep billing on a contract that
  ended: work not invoiced, cancellations or renewals nobody recorded.
- The CRM status contradicts billing for 7 customers, so the app goes by billing and does not use it.
- 3 notes are about prospects and 1 fits two customers; none of them reaches the risk analysis.

Every rule, with its basis and what the numbers would be the other way, is in
[docs/decisions.md](docs/decisions.md).

## The AI, and how it is checked

**Reading the notes.** Each account note goes to the LLM on its own, with a risk scale defined by
principle (high: the customer decided or is acting to leave, or the conflict went beyond the account
manager; medium: a concrete problem or competitive pressure; low; none), the reasons it gives, the note
type, and a quote that justifies the risk. Code checks that every quote appears in its note: 263 of 263
do.

The reading was measured against 40 notes labeled by hand, drawn at random with a fixed seed from the
notes a keyword screen flags and from the rest, and labeled before the LLM ran:

| | Precision at risk | Recall at risk |
|---|---|---|
| LLM | 100% | 100% |
| Keyword screen | 50% | 74% |

The LLM gives the same level as the labels on 88% of the notes; the six differences are one level apart
and on the same side of "at risk". One is a known gap: an escalation to the customer's own management
reads as medium where a person reads high. Billing checks the reading with no label at all: the 9
customers whose notes say high risk bill a median 91% less, all of them less. `npm run eval` reproduces
the report.

**Customer stories.** For each customer to act on, monitor or win back that has notes, the LLM gets the
notes in order and numbered facts computed by code, and returns the root cause, where the account
stands and a suggested next step, each citing the notes and facts it relies on. A verifier in code
checks every citation, and every amount, percentage and date the text gives against what it cites: the
42 stories pass, with 422 citations, 97 amounts and percentages and 112 dates. What code cannot check
is whether a source supports the conclusion drawn from it; a second LLM pass that reviews each claim is
the next step.

## Check it

```bash
npm run verify   # lint, typecheck and tests
npm run eval     # score the LLM's reading of the notes against the hand labels in eval/labels.csv
```

The tests run on small fixtures built for each rule, and on the real exports for invariants that must
hold: every row accounted for, QuickBooks adding up to its own TOTAL row, the bridge adding up to the
change, every story carrying the result its verifier gives today.

## AI tools used

- **Claude Code** (Anthropic): planning the stages, writing the code, the tests and the docs, and
  reviewing the app from screenshots, with a person deciding and reviewing every stage before it was
  committed.
- **OpenAI `gpt-6-luna`**, through the Vercel AI SDK, inside the product: it reads the account notes
  and writes the customer stories. The provider is wired in one file, `src/llm/provider.ts`.

The 40 evaluation labels were set by hand, without AI.

## Next steps

What we would build next; the full list, with what each would take, is in [docs/plan.md](docs/plan.md).

- **A support check on the stories:** a second LLM pass per story that reviews each claim against the
  sources it cites, which is what the code verifier cannot see.
- **Linking customers across the two billing systems from the app:** the LLM proposes pairs, such as the
  four customers split by the system change, with evidence the code computes for both sides, and a
  person confirms.
- **Confirming or reversing an assumption from the app,** with the numbers rebuilt on the spot instead
  of editing the config.
- **Better measurement of the AI:** rounds of hand review to refine the prompts, starting with
  escalations to the customer's management, and ongoing evaluation on a few new notes every week.
- **Period selectors** (quarter, half, fiscal year) and a full customer list.
- **Live integration with NetSuite and Salesforce,** refreshed on a schedule, instead of file exports.
