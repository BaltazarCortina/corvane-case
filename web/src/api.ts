// Reads one resource from the API. The API serves the built files as they are, so the app only shows
// what the pipeline and the LLM step computed.

import { useEffect, useState } from 'react';

export type Loaded<T> = { status: 'loading' } | { status: 'error'; error: string } | { status: 'ready'; data: T };

export function useResource<T>(name: string): Loaded<T> {
  const [state, setState] = useState<Loaded<T>>({ status: 'loading' });
  useEffect(() => {
    let current = true;
    const load = async () => {
      const response = await fetch(`/api/${name}`);
      const body = await response.json();
      if (!current) return;
      if (!response.ok) setState({ status: 'error', error: body.error ?? `Could not load ${name}` });
      else setState({ status: 'ready', data: body });
    };
    load().catch((error: Error) => current && setState({ status: 'error', error: error.message }));
    return () => {
      current = false;
    };
  }, [name]);
  return state;
}
