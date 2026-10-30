// Why billing moved, in a sentence written by code from the bridge: the two steps that moved it the same
// way as the total, the largest first.

import type { Bridge, BridgeKind } from '../../../src/billing/bridge';
import { count, usd } from '../../../src/shared/format';

/** How each step of the bridge is named in a sentence, for its number of customers. */
const STEP_PHRASES: Record<BridgeKind, (customers: number) => string> = {
  stopped: (n) => `${count(n, 'customer')} that stopped billing`,
  less: (n) => `${count(n, 'customer')} billing less`,
  more: (n) => `${count(n, 'customer')} billing more`,
  new: (n) => `${count(n, 'new customer')}`,
};

const signed = (amount: number) => (amount > 0 ? `+${usd(amount)}` : usd(amount));

export function whyBillingMoved(bridge: Bridge): string | null {
  const change = bridge.current - bridge.previous;
  if (change === 0) return null;
  const sameWay = bridge.steps.filter((s) => Math.sign(s.change) === Math.sign(change));
  const drivers = sameWay.sort((a, b) => Math.abs(b.change) - Math.abs(a.change)).slice(0, 2);
  if (drivers.length === 0) return null;
  const phrases = drivers.map((s) => `${STEP_PHRASES[s.kind](s.movers.length)} (${signed(s.change)})`);
  const direction = change < 0 ? 'Down' : 'Up';
  return `${direction} mostly from ${phrases.join(' and ')}.`;
}
