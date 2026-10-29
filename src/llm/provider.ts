// The only file that knows which LLM provider is used. Switching to another provider of the Vercel AI
// SDK means changing this file and nothing else.

import { createOpenAI } from '@ai-sdk/openai';
import type { LanguageModel } from 'ai';

export interface Llm {
  model: LanguageModel;
  /** Provider and model, recorded with every answer and part of every cache key. */
  modelId: string;
}

const DEFAULT_MODEL = 'gpt-6-luna';

/** The configured model, or null when there is no API key. */
export function llmFromEnv(): Llm | null {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  const modelName = process.env.LLM_MODEL || DEFAULT_MODEL;
  const openai = createOpenAI({ apiKey });
  return { model: openai(modelName), modelId: `openai:${modelName}` };
}
