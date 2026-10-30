import { describe, expect, it } from 'vitest';
import type { Bridge, BridgeKind } from '../../src/billing/bridge';
import { whyBillingMoved } from '../../web/src/summary/whyBillingMoved';

const window = {
  current: { label: 'H1 FY27', start: '2026-04-01', end: '2026-09-30' },
  previous: { label: 'H1 FY26', start: '2025-04-01', end: '2025-09-30' },
};

const step = (kind: BridgeKind, change: number, customers: number) => ({
  kind,
  change,
  movers: Array.from({ length: customers }, (_, i) => ({
    customerId: `C-${i}`,
    previous: 0,
    current: 0,
    change: 0,
    atypicalChange: 0,
  })),
});

const bridge = (previous: number, current: number, steps: ReturnType<typeof step>[]): Bridge => ({
  window,
  previous,
  current,
  steps,
});

describe('whyBillingMoved', () => {
  it('names the two steps that moved billing the same way as the total, the largest first', () => {
    const steps = [step('stopped', -1_300_000, 8), step('less', -2_600_000, 74), step('more', 2_100_000, 69)];
    expect(whyBillingMoved(bridge(21_000_000, 19_200_000, steps))).toBe(
      'Down mostly from 74 customers billing less (−$2.6M) and 8 customers that stopped billing (−$1.3M).',
    );
  });

  it('names growth the same way, and nothing when billing did not move', () => {
    const steps = [step('more', 500_000, 3)];
    expect(whyBillingMoved(bridge(1_000_000, 1_500_000, steps))).toBe(
      'Up mostly from 3 customers billing more (+$500k).',
    );
    expect(whyBillingMoved(bridge(1_000_000, 1_000_000, []))).toBeNull();
  });
});
