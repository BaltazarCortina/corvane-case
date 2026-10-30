import type { RiskLevel } from '../../../src/risk/scale';

const COLORS: Record<RiskLevel, string> = {
  high: 'var(--color-risk-high)',
  medium: 'var(--color-risk-medium)',
  low: 'var(--color-risk-low)',
  none: 'var(--color-baseline)',
};

const LABELS: Record<RiskLevel, string> = { high: 'High', medium: 'Medium', low: 'Low', none: 'None' };

/** A risk level as a colored dot and its name, so it never depends on color alone. */
export function RiskBadge({ level, suffix = '' }: { level: RiskLevel; suffix?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <span className="inline-block size-2 rounded-full" style={{ background: COLORS[level] }} />
      <span className="font-medium">
        {LABELS[level]}
        {suffix}
      </span>
    </span>
  );
}
