// A file cache for LLM answers, keyed by everything that can change one: the prompt version, the model
// and the exact input. Running again costs nothing and gives the same answers; changing the prompt or
// the input asks the model again.

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export async function cached<T>(dir: string, key: unknown, compute: () => Promise<T>): Promise<T> {
  const keyJson = JSON.stringify(key);
  const hash = createHash('sha256').update(keyJson).digest('hex').slice(0, 24);
  const file = join(dir, `${hash}.json`);
  if (existsSync(file)) {
    const entry = readFileSync(file, 'utf8');
    return JSON.parse(entry).value;
  }
  const value = await compute();
  mkdirSync(dir, { recursive: true });
  const entry = JSON.stringify({ key, value }, null, 2);
  writeFileSync(file, entry);
  return value;
}
