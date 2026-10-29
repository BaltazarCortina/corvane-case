// Where the pipeline reads its inputs and writes its outputs, relative to the repo root.

import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));

export const paths = {
  raw: `${root}data/raw`,
  build: `${root}data/build`,
  eval: `${root}eval`,
  llm: `${root}data/llm`,
  llmCache: `${root}data/llm/cache`,
  reference: `${root}config/reference.yml`,
  assumptions: `${root}config/assumptions.yml`,
};
