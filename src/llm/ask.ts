// Asking the LLM: one question with an answer that must fit a schema, cached; and many questions at a
// time.

import { generateText, Output } from 'ai';
import type { z } from 'zod';
import { cached } from './cache';
import type { Llm } from './provider';

export interface Question<T> {
  /** Changing the instructions or the schema changes the version, so cached answers are not reused. */
  version: string;
  instructions: string;
  prompt: string;
  schema: z.ZodType<T>;
}

/** The answer, from the cache when the same version, model and prompt were asked before. */
export async function ask<T>(llm: Llm, cacheDir: string, question: Question<T>): Promise<T> {
  const { version, instructions, prompt, schema } = question;
  // The key's fields and their order are part of the hash: changing them misses every cached answer.
  const key = { version, model: llm.modelId, prompt };
  return cached(cacheDir, key, async () => {
    const output = Output.object({ schema });
    const result = await generateText({ model: llm.model, instructions, prompt, output });
    return result.output;
  });
}

/** Runs `fn` over the items with at most `limit` calls in flight. */
export async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  };
  const workers = Array.from({ length: Math.min(limit, items.length) }, worker);
  await Promise.all(workers);
  return results;
}
