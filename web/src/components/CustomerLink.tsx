import type { ReactNode } from 'react';
import { openCustomer } from '../route';

/** A customer's name that opens its panel. */
export function CustomerLink({ customerId, children }: { customerId: string; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={() => openCustomer(customerId)}
      className="text-left text-ink hover:text-series-1 hover:underline"
    >
      {children}
    </button>
  );
}
