import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/server/app';

const root = mkdtempSync(join(tmpdir(), 'corvane-api-'));
const build = join(root, 'build');
mkdirSync(build);
writeFileSync(join(build, 'billing.json'), JSON.stringify({ asOf: '2026-09-30' }));
writeFileSync(join(build, 'parameters.json'), JSON.stringify({ stoppedBillingDays: 90 }));
writeFileSync(join(build, 'model.json'), JSON.stringify({ customers: [{ id: 'C-1' }], invoices: [{ key: 'x' }] }));

const app = createApp({ build });

describe('the API', () => {
  it('serves a built file as it is', async () => {
    const response = await app.request('/api/billing');
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ asOf: '2026-09-30' });
  });

  it('serves only the part of the model asked for', async () => {
    const response = await app.request('/api/customers');
    expect(await response.json()).toEqual([{ id: 'C-1' }]);
  });

  it('says which command writes a missing file', async () => {
    const response = await app.request('/api/worklist');
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'worklist.json is missing: run npm run llm' });
  });

  it('refuses a resource it does not know', async () => {
    const response = await app.request('/api/invoices');
    expect(response.status).toBe(404);
  });

  it('serves the parameters the build used', async () => {
    const response = await app.request('/api/parameters');
    expect(await response.json()).toEqual({ stoppedBillingDays: 90 });
  });
});
