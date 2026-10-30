import type { ReactNode } from 'react';

/** A titled block of a screen, separated by space rather than a box. */
export function Section({ title, aside, children }: { title: ReactNode; aside?: ReactNode; children: ReactNode }) {
  return (
    <section>
      <div className="mb-3 flex items-baseline justify-between gap-4">
        <h2 className="font-semibold text-ink text-lg">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}
