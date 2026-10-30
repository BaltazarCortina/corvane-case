// The app's frame: a header with the screens and the screen in view. Each screen has its own address, so
// a link or a reload lands on the same screen.

import { useEffect, useState } from 'react';
import { BillingPage } from './billing/BillingPage';

const SCREENS = [{ path: 'billing', label: 'Billing', render: () => <BillingPage /> }];

function currentPath(): string {
  const path = window.location.hash.replace(/^#\/?/, '');
  return SCREENS.some((s) => s.path === path) ? path : SCREENS[0].path;
}

export function App() {
  const [path, setPath] = useState(currentPath);
  useEffect(() => {
    const onChange = () => setPath(currentPath());
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  const screen = SCREENS.find((s) => s.path === path) ?? SCREENS[0];

  return (
    <div className="min-h-screen bg-page font-sans text-ink">
      <header className="border-hairline border-b bg-surface">
        <div className="mx-auto flex max-w-6xl items-center gap-8 px-6 py-4">
          <div>
            <p className="font-semibold">Corvane Fire &amp; Safety</p>
            <p className="text-ink-muted text-xs">Billing, customers at risk and data health</p>
          </div>
          <nav className="flex gap-1">
            {SCREENS.map((s) => (
              <a
                key={s.path}
                href={`#/${s.path}`}
                aria-current={s.path === path ? 'page' : undefined}
                className={`rounded-md px-3 py-1.5 text-sm ${s.path === path ? 'bg-page font-medium text-ink' : 'text-ink-secondary hover:bg-page'}`}
              >
                {s.label}
              </a>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">{screen.render()}</main>
    </div>
  );
}
