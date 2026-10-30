// Reading the files the steps write.

import { readFileSync } from 'node:fs';

export function readJson<T>(file: string): T {
  const text = readFileSync(file, 'utf8');
  return JSON.parse(text);
}
