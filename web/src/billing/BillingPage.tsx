// What is actually happening to billing. The last complete half answers first; the last twelve months
// qualify it; the chart shows the months behind both; and the bridge says which customers moved it.

import { useState } from 'react';
import type { BillingAnalysis } from '../../../src/billing/analyze';
import type { WindowComparison } from '../../../src/billing/billing';
import type { Parameters } from '../../../src/model/assumptions';
import type { CustomerRecord } from '../../../src/model/model';
import { monthLabel, monthOf } from '../../../src/shared/calendar';
import { usd } from '../../../src/shared/format';
import { useResource } from '../api';
import { Change } from '../components/Change';
import { InfoTip } from '../components/InfoTip';
import { Section } from '../components/Section';
import { Tabs } from '../components/Tabs';
import { WhenLoaded } from '../components/WhenLoaded';
import { BridgeView } from './BridgeView';
import { MonthlyChart } from './MonthlyChart';
import { ServiceLines } from './ServiceLines';

export function BillingPage() {
  const billing = useResource<BillingAnalysis>('billing');
  const customers = useResource<CustomerRecord[]>('customers');
  const parameters = useResource<Parameters>('parameters');
  return (
    <WhenLoaded resources={[billing, customers, parameters]}>
      {(b: BillingAnalysis, c: CustomerRecord[], p: Parameters) => <Billing billing={b} customers={c} parameters={p} />}
    </WhenLoaded>
  );
}

type View = 'months' | 'lines';

function Billing({
  billing,
  customers,
  parameters,
}: {
  billing: BillingAnalysis;
  customers: CustomerRecord[];
  parameters: Parameters;
}) {
  const [view, setView] = useState<View>('months');
  const half = billing.half.window;
  const systemChangeMonth = monthLabel(monthOf(billing.systemChange));
  const atypical = (
    <InfoTip term="atypical invoices">
      A one-off project: an invoice outside {parameters.atypicalInvoiceExcludedLines.join(' and ')}, of at least{' '}
      {usd(parameters.atypicalInvoiceMinimum)} and at least {parameters.atypicalInvoiceMultiple} times what its customer
      bills in an average month. Shown apart so a project does not hide or fake a trend.
    </InfoTip>
  );

  return (
    <div className="space-y-10">
      <header>
        <h1 className="font-semibold text-2xl">Billing</h1>
        <p className="mt-1 text-ink-secondary text-sm">
          Net billings
          <InfoTip term="net billings">
            What was invoiced and counts, by invoice date and net of credit memos. Duplicate rows and voided invoices do
            not count. It is not revenue: the exports do not say when the service was delivered.
          </InfoTip>{' '}
          · data to {billing.asOf} · NetSuite from {systemChangeMonth}, QuickBooks before
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-[3fr_2fr]">
        <WindowTile
          prominent
          title="Last complete half"
          comparison={billing.half}
          periodInfo={
            <InfoTip term={half.current.label}>
              {half.current.label} runs from {half.current.start} to {half.current.end}. It is compared with the same
              half a year earlier, {half.previous.label} ({half.previous.start} to {half.previous.end}), because billing
              is seasonal.
            </InfoTip>
          }
          atypicalInfo={atypical}
        >
          {billing.open && (
            <p className="text-ink-secondary">
              {Math.round(billing.open.share * 100)}% ({usd(billing.open.amount)}) still open when exported
            </p>
          )}
        </WindowTile>
        <WindowTile title="Last twelve months" comparison={billing.twelveMonths} atypicalInfo={atypical}>
          {billing.twelveMonths.crossesSystemChange && (
            <p className="text-ink-secondary">⚠ Compares QuickBooks with NetSuite months</p>
          )}
        </WindowTile>
      </div>

      <Section
        title={
          view === 'months'
            ? 'Billing by month'
            : `By service line, ${half.previous.label} against ${half.current.label}`
        }
        aside={
          <Tabs
            tabs={[
              { key: 'months', label: 'By month' },
              { key: 'lines', label: 'By service line' },
            ]}
            selected={view}
            onSelect={setView}
          />
        }
      >
        {view === 'months' ? (
          <MonthlyChart months={billing.months} systemChange={billing.systemChange} window={half} />
        ) : (
          <ServiceLines lines={billing.serviceLines} window={half} />
        )}
      </Section>

      <Section
        title={
          <>
            From {half.previous.label} to {half.current.label}
            <InfoTip term="the bridge">
              Every customer is in one step. Stopped: billed in {half.previous.label} and nothing in{' '}
              {half.current.label}. New: the reverse. Billed less or more: billed in both. Invoices with no customer
              move as one more line, so the steps add up to the change.
            </InfoTip>
          </>
        }
      >
        <BridgeView bridge={billing.bridge} customers={customers} />
      </Section>
    </div>
  );
}

function WindowTile({
  title,
  comparison,
  prominent = false,
  periodInfo,
  atypicalInfo,
  children,
}: {
  title: string;
  comparison: WindowComparison;
  prominent?: boolean;
  periodInfo?: React.ReactNode;
  atypicalInfo: React.ReactNode;
  children?: React.ReactNode;
}) {
  const { window, total, withoutAtypical } = comparison;
  return (
    <section
      className={`rounded-xl p-6 ${prominent ? 'border border-hairline bg-surface shadow-sm' : 'border border-hairline/70 bg-surface/60'}`}
    >
      <h2 className="font-medium text-ink-secondary text-sm">{title}</h2>
      <p className="mt-0.5 text-ink-muted text-xs">
        {window.current.label} against {window.previous.label}
        {periodInfo}
      </p>
      <p className={`mt-4 font-semibold tracking-tight ${prominent ? 'text-5xl' : 'text-3xl'}`}>{usd(total.current)}</p>
      <p className={`mt-2 ${prominent ? 'text-lg' : 'text-base'}`}>
        <Change pct={total.changePct} className="font-semibold" />
        <span className="text-ink-secondary"> against {usd(total.previous)}</span>
      </p>
      <div className="mt-4 space-y-1 border-hairline border-t pt-3 text-sm">
        <p>
          <span className="text-ink-secondary">Without atypical invoices</span>
          {atypicalInfo}
          <span className="text-ink-secondary">: </span>
          <span className="font-medium">{usd(withoutAtypical.current)}</span>{' '}
          <Change pct={withoutAtypical.changePct} className="font-medium" />
        </p>
        {children}
      </div>
    </section>
  );
}
