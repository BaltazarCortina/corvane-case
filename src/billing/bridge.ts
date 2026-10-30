// The bridge from one period's billing to the next: how much of the change comes from customers that
// stopped billing, billed less, billed more, or are new. The steps always add up to the change.

import { contains, type Window } from '../shared/calendar';
import { groupBy } from '../shared/collections';
import { sumMoney } from '../shared/money';
import { type BilledInvoice, totalIn } from './billing';

export type BridgeKind = 'stopped' | 'less' | 'more' | 'new';

export interface Mover {
  /** Null for invoices no customer could be found for. */
  customerId: string | null;
  previous: number;
  current: number;
  change: number;
  /** How much of the change comes from atypical invoices. */
  atypicalChange: number;
}

export interface BridgeStep {
  kind: BridgeKind;
  change: number;
  movers: Mover[];
}

export interface Bridge {
  window: Window;
  previous: number;
  current: number;
  steps: BridgeStep[];
}

const KINDS: BridgeKind[] = ['stopped', 'less', 'more', 'new'];

export function bridge(invoices: BilledInvoice[], window: Window): Bridge {
  const inWindow = invoices.filter((i) => contains(window.previous, i.date) || contains(window.current, i.date));
  const byCustomer = groupBy(inWindow, (i) => i.customerId);
  const movers = new Map<BridgeKind, Mover[]>();
  for (const [customerId, own] of byCustomer) {
    const mover = moverOf(customerId, own, window);
    const kind = kindOf(own, mover, window);
    if (!kind) continue;
    const list = movers.get(kind) ?? [];
    list.push(mover);
    movers.set(kind, list);
  }

  const steps = KINDS.map((kind) => {
    const own = movers.get(kind) ?? [];
    const sorted = own.sort((a, b) => Math.abs(b.change) - Math.abs(a.change));
    const changes = sorted.map((m) => m.change);
    return { kind, change: sumMoney(changes), movers: sorted };
  });
  const previous = totalIn(inWindow, window.previous);
  const current = totalIn(inWindow, window.current);
  return { window, previous, current, steps };
}

function moverOf(customerId: string | null, invoices: BilledInvoice[], window: Window): Mover {
  const previous = totalIn(invoices, window.previous);
  const current = totalIn(invoices, window.current);
  const atypical = invoices.filter((i) => i.atypical);
  const atypicalPrevious = totalIn(atypical, window.previous);
  const atypicalCurrent = totalIn(atypical, window.current);
  return {
    customerId,
    previous,
    current,
    change: sumMoney([current, -previous]),
    atypicalChange: sumMoney([atypicalCurrent, -atypicalPrevious]),
  };
}

/**
 * Stopped: invoiced in the previous period and not at all in the current one. New: the reverse. Otherwise
 * less or more by the change; a customer whose billing did not change is not a step.
 */
function kindOf(invoices: BilledInvoice[], mover: Mover, window: Window): BridgeKind | null {
  const billedBefore = invoices.some((i) => contains(window.previous, i.date));
  const billedAfter = invoices.some((i) => contains(window.current, i.date));
  if (!billedAfter) return 'stopped';
  if (!billedBefore) return 'new';
  if (mover.change < 0) return 'less';
  if (mover.change > 0) return 'more';
  return null;
}
