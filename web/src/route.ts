// The address of what is on screen, kept in the URL hash: the screen and, when one is open, the customer,
// as in `#/worklist?customer=C-0160`. A link or a reload lands on the same view.

import { useEffect, useState } from 'react';

export interface Route {
  screen: string;
  customer: string | null;
}

function readRoute(): Route {
  const hash = window.location.hash.replace(/^#\/?/, '');
  const [screen, query = ''] = hash.split('?');
  const params = new URLSearchParams(query);
  return { screen, customer: params.get('customer') };
}

export function useRoute(): Route {
  const [route, setRoute] = useState(readRoute);
  useEffect(() => {
    const onChange = () => setRoute(readRoute());
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}

/** The address of a screen, with a customer open on it or none. */
export function hrefOf(screen: string, customer: string | null = null): string {
  return customer ? `#/${screen}?customer=${encodeURIComponent(customer)}` : `#/${screen}`;
}

/** Opens a customer over the current screen. */
export function openCustomer(customerId: string): void {
  const { screen } = readRoute();
  window.location.hash = hrefOf(screen, customerId);
}

export function closeCustomer(): void {
  const { screen } = readRoute();
  window.location.hash = hrefOf(screen);
}
