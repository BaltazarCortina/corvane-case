// Everything the app shows about billing, computed from the model in one pass.

import type { Parameters } from '../model/assumptions';
import { build, type Inputs } from '../model/build';
import type { Model } from '../model/model';
import { halfWindow, twelveMonthWindow } from '../shared/calendar';
import {
  billedInvoices,
  byServiceLine,
  compareWindow,
  type LineTotal,
  type MonthPoint,
  monthlySeries,
  type OpenAmount,
  openAmount,
  systemChangeDate,
  type WindowComparison,
} from './billing';
import { type Bridge, bridge } from './bridge';

export interface BillingAnalysis {
  /** The date of the latest invoice: the data is complete up to it. */
  asOf: string;
  systemChange: string;
  half: WindowComparison;
  twelveMonths: WindowComparison;
  serviceLines: LineTotal[];
  bridge: Bridge;
  open: OpenAmount | null;
  months: MonthPoint[];
}

/** The model and its billing analysis, built from one set of inputs. */
export interface Built {
  model: Model;
  billing: BillingAnalysis;
}

export function analyze(inputs: Inputs): Built {
  const model = build(inputs);
  const { parameters } = inputs.assumptions;
  const billing = analyzeBilling(model, parameters, inputs.reference.fiscalYearStartMonth);
  return { model, billing };
}

export function analyzeBilling(model: Model, parameters: Parameters, fiscalYearStartMonth: number): BillingAnalysis {
  const invoices = billedInvoices(model, parameters);
  const dates = invoices.map((i) => i.date).sort();
  const asOf = dates[dates.length - 1];
  const systemChange = systemChangeDate(model.invoices);

  const halves = halfWindow(asOf, fiscalYearStartMonth);
  const twelveMonths = twelveMonthWindow(asOf);
  return {
    asOf,
    systemChange,
    half: compareWindow(invoices, halves, systemChange),
    twelveMonths: compareWindow(invoices, twelveMonths, systemChange),
    serviceLines: byServiceLine(invoices, halves),
    bridge: bridge(invoices, halves),
    open: openAmount(invoices, halves.current),
    months: monthlySeries(invoices, asOf),
  };
}
