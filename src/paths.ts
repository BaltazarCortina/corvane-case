// Where the pipeline reads its inputs and writes its outputs, relative to the repo root.

import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));

export const paths = {
  raw: `${root}data/raw`,
  build: `${root}data/build`,
  eval: `${root}eval`,
  /** The LLM's answers, apart from the outputs: clearing those does not ask the LLM again. */
  llmCache: `${root}data/cache/llm`,
  reference: `${root}config/reference.yml`,
  assumptions: `${root}config/assumptions.yml`,
};
