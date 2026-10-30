import type { ReactNode } from 'react';

export function Notice({ children }: { children: ReactNode }) {
  return <p className="rounded-md border border-hairline bg-page p-4 text-ink-secondary text-sm">{children}</p>;
}
