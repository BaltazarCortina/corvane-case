// The story of one customer: what is happening, why, where it stands and a suggested next step. The LLM
// gets the customer's notes in order and the facts code computed, and cites them in every claim, so the
// verifier can check each claim against its sources. Stories are written only for customers in the
// worklist groups that need one and that have notes to read.

import { z } from 'zod';
import type { BillingAnalysis } from '../billing/analyze';
import type { BilledInvoice } from '../billing/billing';
import type { Finding } from '../findings/cases';
import { ask } from '../llm/ask';
import type { Llm } from '../llm/provider';
import type { Parameters } from '../model/assumptions';
import { currentContractOf, type Model, type Note } from '../model/model';
import type { CustomerAssessment, Worklist, WorklistGroup } from '../risk/worklist';
import { groupBy } from '../shared/collections';
import { type Fact, storyFacts } from './facts';
import { type StoryCheck, verifyStory } from './verify';

/** Changing the instructions or the schema changes this, so cached answers are not reused. */
export const STORY_PROMPT_VERSION = 'stories-1';

/** Renewals are healthy customers with a date coming up: they need a reminder, not a story. */
export const STORY_GROUPS: WorklistGroup[] = ['actNow', 'monitor', 'winBack'];

export const TRAJECTORIES = ['lost', 'worsening', 'stable', 'improving'] as const;

const claim = z.object({ text: z.string(), cites: z.array(z.string()) });

const answerSchema = z.object({
  headline: z.string(),
  trajectory: z.enum(TRAJECTORIES),
  rootCause: claim,
  currentState: claim,
  nextStep: claim,
});

type Answer = z.infer<typeof answerSchema>;

export interface CustomerStory extends Answer {
  customerId: string;
  facts: Fact[];
  /** The notes the story was written from, oldest first. */
  noteIds: string[];
  check: StoryCheck;
  model: string;
  promptVersion: string;
  /** The as-of date of the data the story was written from. */
  asOf: string;
}

/** What one story is written from. */
export interface StoryInput {
  assessment: CustomerAssessment;
  facts: Fact[];
  notes: Note[];
}

const INSTRUCTIONS = `You help the CFO of Corvane Fire & Safety Services, a commercial fire protection company, and the operating partner of its private equity owner understand one customer account.

You get numbered facts computed by code from billing, contracts and data checks (F1, F2...), and the account manager's notes about the customer (N-...), oldest first. Use only that material.

Return:
- headline: what is happening with this account, at most 15 words.
- trajectory: lost if the customer stopped billing; otherwise worsening, stable or improving, judged on billing and the latest notes.
- rootCause: what puts the account at risk, as the notes show it. When a note gives the customer's own reason, such as a notice that names missed inspections, state it as their reason. When the notes show a sequence instead, such as late reports, then a competing quote, then the customer leaving, describe that sequence as what the notes show, without presenting it as the reason the customer gave. Do not link billing to an event only because they happen around the same time. If the notes record no problem, say so in one sentence, without speculating about why billing moved.
- currentState: where the account stands now: billing, contract and the latest note.
- nextStep: one concrete step for the next 30 days, who should take it (the account manager by name, if the facts give one) and why now. It is a suggestion for people who know the account better.

rootCause, currentState and nextStep each have a text and cites: the ids of the facts and notes the text relies on, only ids from the input.

Rules:
- Copy every dollar amount and percentage exactly as a fact or note you cite writes it. Do not round them or compute new ones.
- Write dates as the input does (2026-05-16) or as month and year (May 2026), and cite the note or fact they come from.
- If the notes and billing disagree, say so. If a data finding may explain the billing, such as a contract billed far below its value, say the numbers may reflect the data rather than the customer.
- Plain English, at most 40 words per text. No ids in any text: they go in cites.`;

/** The customers that get a story, in worklist order, with the facts and notes it is written from. */
export function storyInputs(
  model: Model,
  billing: BillingAnalysis,
  worklist: Worklist,
  findings: Finding[],
  invoices: BilledInvoice[],
  parameters: Parameters,
): StoryInput[] {
  const customers = new Map(model.customers.map((c) => [c.id, c]));
  const contractOf = currentContractOf(model);
  const notesOf = groupBy(model.notes, (n) => n.customerId);
  const invoicesOf = groupBy(invoices, (i) => i.customerId);
  const inputs: StoryInput[] = [];
  for (const assessment of worklist.customers) {
    const notes = notesOf.get(assessment.customerId) ?? [];
    const customer = customers.get(assessment.customerId);
    const needsStory = assessment.group !== null && STORY_GROUPS.includes(assessment.group);
    if (!customer || !needsStory || notes.length === 0) continue;
    const contract = contractOf(customer);
    const facts = storyFacts({
      customer,
      assessment,
      contract,
      invoices: invoicesOf.get(customer.id) ?? [],
      billing,
      findings,
      stoppedBillingDays: parameters.stoppedBillingDays,
    });
    const sorted = [...notes].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
    inputs.push({ assessment, facts, notes: sorted });
  }
  return inputs;
}

export function storyPrompt(input: StoryInput): string {
  const facts = input.facts.map((f) => `${f.id}: ${f.text}`);
  const notes = input.notes.map((n) => `${n.id}, ${n.date}, ${n.author}: ${n.text}`);
  return [`Customer: ${input.assessment.name}`, '', 'Facts:', ...facts, '', 'Notes, oldest first:', ...notes].join(
    '\n',
  );
}

export async function writeStory(input: StoryInput, llm: Llm, cacheDir: string, asOf: string): Promise<CustomerStory> {
  const prompt = storyPrompt(input);
  const question = { version: STORY_PROMPT_VERSION, instructions: INSTRUCTIONS, prompt, schema: answerSchema };
  const answer = await ask(llm, cacheDir, question);
  const check = verifyStory(answer, input.facts, input.notes);
  return {
    customerId: input.assessment.customerId,
    ...answer,
    facts: input.facts,
    noteIds: input.notes.map((n) => n.id),
    check,
    model: llm.modelId,
    promptVersion: STORY_PROMPT_VERSION,
    asOf,
  };
}
