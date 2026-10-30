// The API: serves the files the pipeline, the LLM step and the evaluation wrote to data/build, as they
// are. It computes nothing, so the app shows exactly what was built and tested, with the parameters it was
// built with. Files are read on every request, so running the pipeline
// again shows in the app without a restart.

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Hono } from 'hono';

interface Resource {
  file: string;
  /** The part of the file served, for the model, which is too large to send whole. */
  part?: string;
  writtenBy: string;
}

const RESOURCES: Record<string, Resource> = {
  billing: { file: 'billing.json', writtenBy: 'npm run pipeline' },
  findings: { file: 'findings.json', writtenBy: 'npm run pipeline' },
  // The thresholds behind the definitions the app shows, as the pipeline used them.
  parameters: { file: 'parameters.json', writtenBy: 'npm run pipeline' },
  customers: { file: 'model.json', part: 'customers', writtenBy: 'npm run pipeline' },
  contracts: { file: 'model.json', part: 'contracts', writtenBy: 'npm run pipeline' },
  notes: { file: 'model.json', part: 'notes', writtenBy: 'npm run pipeline' },
  reconciliation: { file: 'model.json', part: 'reconciliation', writtenBy: 'npm run pipeline' },
  'note-signals': { file: 'note-signals.json', writtenBy: 'npm run llm' },
  worklist: { file: 'worklist.json', writtenBy: 'npm run llm' },
  stories: { file: 'stories.json', writtenBy: 'npm run llm' },
  evaluation: { file: 'eval-report.json', writtenBy: 'npm run eval' },
};

export interface AppPaths {
  build: string;
}

export function createApp(paths: AppPaths): Hono {
  const app = new Hono();

  app.get('/api/:name', (c) => {
    const name = c.req.param('name');
    const resource = RESOURCES[name];
    if (!resource) return c.json({ error: `No resource named ${name}` }, 404);
    const file = join(paths.build, resource.file);
    if (!existsSync(file)) return c.json({ error: `${resource.file} is missing: run ${resource.writtenBy}` }, 404);
    const text = readFileSync(file, 'utf8');
    if (!resource.part) return c.body(text, 200, { 'content-type': 'application/json' });
    const content = JSON.parse(text);
    return c.json(content[resource.part]);
  });

  return app;
}
