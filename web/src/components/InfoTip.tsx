import type { ReactNode } from 'react';

/**
 * The definition of a term that is not obvious, next to the term: shown on hover or keyboard focus, so it
 * is there when needed and out of the way otherwise.
 */
export function InfoTip({ term, children }: { term: string; children: ReactNode }) {
  return (
    <span className="group relative inline-flex align-middle">
      <button
        type="button"
        aria-label={`What ${term} means`}
        className="ml-1 inline-flex size-4 items-center justify-center rounded-full border border-baseline font-medium text-[10px] text-ink-muted leading-none hover:border-ink-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-series-1"
      >
        i
      </button>
      <span
        role="tooltip"
        className="invisible absolute top-full left-0 z-20 mt-2 w-80 rounded-md border border-hairline bg-surface p-3 font-normal text-ink-secondary text-xs leading-relaxed opacity-0 shadow-md transition-opacity group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100"
      >
        {children}
      </span>
    </span>
  );
}
