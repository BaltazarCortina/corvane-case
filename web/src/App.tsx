// The app's frame: a header with the screens, the screen in view and, over it, the customer panel when a
// customer is open. Each view has its own address, so a link or a reload lands on the same view.

import { BillingPage } from './billing/BillingPage';
import { CustomerPanel } from './customer/CustomerPanel';
import { DataPage } from './data/DataPage';
import { hrefOf, useRoute } from './route';
import { SummaryPage } from './summary/SummaryPage';
import { WorklistPage } from './worklist/WorklistPage';

const SCREENS = [
  { path: 'summary', label: 'Summary', render: () => <SummaryPage /> },
  { path: 'billing', label: 'Billing', render: () => <BillingPage /> },
  { path: 'worklist', label: 'Worklist', render: () => <WorklistPage /> },
  { path: 'data', label: 'Data', render: () => <DataPage /> },
];

export function App() {
  const route = useRoute();
  const screen = SCREENS.find((s) => s.path === route.screen) ?? SCREENS[0];

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
                href={hrefOf(s.path)}
                aria-current={s === screen ? 'page' : undefined}
                className={`rounded-md px-3 py-1.5 text-sm ${s === screen ? 'bg-page font-medium text-ink' : 'text-ink-secondary hover:bg-page'}`}
              >
                {s.label}
              </a>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">{screen.render()}</main>
      {route.customer && <CustomerPanel customerId={route.customer} />}
    </div>
  );
}
