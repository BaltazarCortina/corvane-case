// What to know today, on one screen, in two columns: billing, why it moved and its last eighteen months;
// and the customers to act on now, what to know about them and who they are. Each card leads to its screen.

import type { BillingAnalysis } from '../../../src/billing/analyze';
import type { CustomerAssessment, Worklist } from '../../../src/risk/worklist';
import { monthOf, type Period, rangeLabel } from '../../../src/shared/calendar';
import { usd } from '../../../src/shared/format';
import { sumMoney } from '../../../src/shared/money';
import { useResource } from '../api';
import { MonthlyChart } from '../billing/MonthlyChart';
import { Change } from '../components/Change';
import { RiskBadge } from '../components/RiskBadge';
import { Section } from '../components/Section';
import { WhenLoaded } from '../components/WhenLoaded';
import { hrefOf, openCustomer } from '../route';
import { ActNowFacts } from '../worklist/ActNowFacts';
import { whyBillingMoved } from './whyBillingMoved';

/** Customers to act on listed here; the rest are in the worklist. */
const ACT_NOW_SHOWN = 10;

/** "Apr–Sep 2026": the months a period covers. */
function periodRange(period: Period): string {
  const from = monthOf(period.start);
  const to = monthOf(period.end);
  return rangeLabel(from, to);
}

/** Months of billing in the chart. */
const MONTHS_SHOWN = 18;

export function SummaryPage() {
  const billing = useResource<BillingAnalysis>('billing');
  const worklist = useResource<Worklist>('worklist');
  return (
    <WhenLoaded resources={[billing, worklist]}>
      {(b: BillingAnalysis, w: Worklist) => <Summary billing={b} worklist={w} />}
    </WhenLoaded>
  );
}

function Summary({ billing, worklist }: { billing: BillingAnalysis; worklist: Worklist }) {
  const inGroup = (group: string) => worklist.customers.filter((c) => c.group === group);
  const actNow = inGroup('actNow');
  const winBack = inGroup('winBack');
  const renewals = inGroup('renewals').filter((c) => !c.healthyAutoRenewal);
  const why = whyBillingMoved(billing.bridge);
  const recentMonths = billing.months.slice(-MONTHS_SHOWN);
  const { half, twelveMonths } = billing;

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-semibold text-2xl">Summary</h1>
        <p className="mt-1 text-ink-secondary text-sm">Data to {billing.asOf}</p>
      </header>

      {/* Two rows across both columns: the cards side by side at the same height, their detail below. */}
      <div className="grid gap-8 lg:grid-cols-2">
        <Card title="Billing" subtitle={`Last complete half, against ${half.window.previous.label}`} link="billing">
          <p className="font-semibold text-5xl tracking-tight">{usd(half.total.current)}</p>
          <p className="mt-1 text-ink-secondary text-sm">
            Net billings in {half.window.current.label}, {periodRange(half.window.current)}
          </p>
          <p className="mt-2 text-lg">
            <Change pct={half.total.changePct} className="font-semibold" />
            <span className="text-ink-secondary"> against {usd(half.total.previous)}</span>
          </p>
          {why && <p className="mt-2 text-ink-secondary text-sm">{why}</p>}
          <div className="mt-4 space-y-1 border-hairline border-t pt-3 text-sm">
            <p>
              <span className="text-ink-secondary">Without atypical invoices: </span>
              <Change pct={half.withoutAtypical.changePct} className="font-medium" />
            </p>
            <p>
              <span className="text-ink-secondary">Last twelve months: </span>
              <Change pct={twelveMonths.total.changePct} className="font-medium" />
            </p>
          </div>
        </Card>
        <Card
          title="Act now"
          subtitle="Customers at high risk, or at medium risk with the contract ending"
          link="worklist"
        >
          <ActNowFacts customers={actNow} />
          <div className="mt-4 space-y-1 border-hairline border-t pt-3 text-sm">
            <p>
              <span className="text-ink-secondary">Win back: </span>
              <span className="font-medium">{winBack.length} customers</span>
              <span className="text-ink-secondary">
                {' '}
                stopped billing in the last year, {usd(stakeOf(winBack))} in the 12 months before each left
              </span>
            </p>
            <p>
              <span className="text-ink-secondary">Renewals: </span>
              <span className="font-medium">{renewals.length} contracts</span>
              <span className="text-ink-secondary"> ending soon or already ended</span>
            </p>
          </div>
        </Card>

        <Section title={`Billing by quarter, last ${MONTHS_SHOWN} months`}>
          <MonthlyChart
            months={recentMonths}
            systemChange={billing.systemChange}
            window={half.window}
            compact
            by="quarter"
          />
        </Section>
        <Section
          title="To act on now"
          aside={
            actNow.length > ACT_NOW_SHOWN && (
              <a href={hrefOf('worklist')} className="text-series-1 text-sm hover:underline">
                All {actNow.length} in the worklist →
              </a>
            )
          }
        >
          <ActNowList customers={actNow.slice(0, ACT_NOW_SHOWN)} />
        </Section>
      </div>
    </div>
  );
}

function Card({
  title,
  subtitle,
  link,
  children,
}: {
  title: string;
  subtitle: string;
  link: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col rounded-xl border border-hairline bg-surface p-6 shadow-sm">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="font-medium text-ink-secondary text-sm">{title}</h2>
        <a href={hrefOf(link)} className="text-series-1 text-sm hover:underline">
          Open →
        </a>
      </div>
      <p className="mt-0.5 text-ink-muted text-xs">{subtitle}</p>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function ActNowList({ customers }: { customers: CustomerAssessment[] }) {
  return (
    <ul className="divide-y divide-hairline rounded-xl border border-hairline bg-surface">
      {customers.map((c) => (
        <li key={c.customerId}>
          <button
            type="button"
            onClick={() => openCustomer(c.customerId)}
            className="grid w-full grid-cols-[1fr_auto] items-baseline gap-3 px-4 py-2.5 text-left hover:bg-page"
          >
            <span>
              <span className="font-medium">{c.name}</span>
              <span className="mt-0.5 flex items-center gap-2 text-ink-secondary text-xs">
                <RiskBadge level={c.risk.level} />
                <span className="truncate">{c.risk.reason}</span>
              </span>
            </span>
            <span className="font-medium text-sm tabular-nums">{usd(c.amountAtStake)}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function stakeOf(customers: CustomerAssessment[]): number {
  const amounts = customers.map((c) => c.amountAtStake);
  return sumMoney(amounts);
}
