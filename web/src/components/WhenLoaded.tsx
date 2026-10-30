import type { ReactNode } from 'react';
import type { Loaded } from '../api';
import { Notice } from './Notice';

/** Renders the content once every resource it needs has loaded, or says what is missing. */
export function WhenLoaded<T extends unknown[]>({
  resources,
  children,
}: {
  resources: { [K in keyof T]: Loaded<T[K]> };
  children: (...data: T) => ReactNode;
}) {
  const failed = resources.find((r) => r.status === 'error');
  if (failed?.status === 'error') return <Notice>{failed.error}</Notice>;
  if (resources.some((r) => r.status === 'loading')) return <p className="text-ink-muted text-sm">Loading…</p>;
  const data = resources.map((r) => (r.status === 'ready' ? r.data : null)) as T;
  return <>{children(...data)}</>;
}
