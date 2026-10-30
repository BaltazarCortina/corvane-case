// Dates and periods. Dates are ISO strings (`YYYY-MM-DD`), which sort and compare as text. A fiscal
// year is named by the calendar year it ends in: with an April start, FY27 runs April 2026 to March 2027.

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export interface Period {
  label: string;
  /** First day, inclusive. */
  start: string;
  /** Last day, inclusive. */
  end: string;
}

/** A period and the one it is compared against. */
export interface Window {
  current: Period;
  previous: Period;
}

const pad = (n: number) => String(n).padStart(2, '0');

const toDate = (iso: string) => new Date(`${iso}T00:00:00Z`);

const toIso = (date: Date) => date.toISOString().slice(0, 10);

/** `2026-09` for any date in September 2026. */
export const monthOf = (iso: string) => iso.slice(0, 7);

/** `Sep 2026` for `2026-09`. */
export function monthLabel(month: string): string {
  const [year, m] = month.split('-').map(Number);
  return `${MONTH_NAMES[m - 1]} ${year}`;
}

export function addDays(iso: string, days: number): string {
  const date = toDate(iso);
  date.setUTCDate(date.getUTCDate() + days);
  return toIso(date);
}

/** The last day of the month the date is in. */
export function monthEnd(iso: string): string {
  const [year, month] = iso.split('-').map(Number);
  const lastDay = new Date(Date.UTC(year, month, 0));
  return toIso(lastDay);
}

/** The same day some months later or earlier, moved back to the month's last day if it does not exist. */
export function addMonths(iso: string, months: number): string {
  const [year, month, day] = iso.split('-').map(Number);
  const first = new Date(Date.UTC(year, month - 1 + months, 1));
  const firstIso = toIso(first);
  const lastDay = Number(monthEnd(firstIso).slice(8));
  return `${firstIso.slice(0, 8)}${pad(Math.min(day, lastDay))}`;
}

/** Every month from the one `from` is in to the one `to` is in, as `YYYY-MM`. */
export function monthsBetween(from: string, to: string): string[] {
  const months: string[] = [];
  const last = monthOf(to);
  for (let date = `${monthOf(from)}-01`; monthOf(date) <= last; date = addMonths(date, 1)) {
    months.push(monthOf(date));
  }
  return months;
}

export function fiscalYearOf(iso: string, startMonth: number): number {
  const [year, month] = iso.split('-').map(Number);
  return startMonth > 1 && month >= startMonth ? year + 1 : year;
}

/** The first or second half of a fiscal year. */
export function fiscalHalf(fiscalYear: number, half: 1 | 2, startMonth: number): Period {
  const startYear = startMonth > 1 ? fiscalYear - 1 : fiscalYear;
  const yearStart = `${startYear}-${pad(startMonth)}-01`;
  const start = addMonths(yearStart, half === 1 ? 0 : 6);
  const lastMonth = addMonths(start, 5);
  const end = monthEnd(lastMonth);
  const label = `H${half} FY${String(fiscalYear).slice(-2)}`;
  return { label, start, end };
}

/** The latest fiscal half that ends on or before the as-of date. */
export function lastCompleteHalf(asOf: string, startMonth: number): Period {
  const fiscalYear = fiscalYearOf(asOf, startMonth);
  const candidates = [
    fiscalHalf(fiscalYear, 2, startMonth),
    fiscalHalf(fiscalYear, 1, startMonth),
    fiscalHalf(fiscalYear - 1, 2, startMonth),
  ];
  const complete = candidates.find((p) => p.end <= asOf);
  if (!complete) throw new Error(`No complete fiscal half before ${asOf}`);
  return complete;
}

/** The last complete fiscal half against the same half a year earlier. */
export function halfWindow(asOf: string, startMonth: number): Window {
  const current = lastCompleteHalf(asOf, startMonth);
  const fiscalYear = fiscalYearOf(current.start, startMonth);
  const half = current.start === fiscalHalf(fiscalYear, 1, startMonth).start ? 1 : 2;
  const previous = fiscalHalf(fiscalYear - 1, half, startMonth);
  return { current, previous };
}

/** The twelve months ending on the as-of date against the twelve before them. */
export function twelveMonthWindow(asOf: string): Window {
  const current = twelveMonthsTo(asOf);
  const previousEnd = addMonths(asOf, -12);
  const previous = twelveMonthsTo(previousEnd);
  return { current, previous };
}

/** The twelve months ending on a date. */
export function twelveMonthsTo(end: string): Period {
  const yearBefore = addMonths(end, -12);
  const start = addDays(yearBefore, 1);
  const endMonth = monthLabel(monthOf(end));
  return { label: `12 months to ${endMonth}`, start, end };
}

export const contains = (period: Period, iso: string) => iso >= period.start && iso <= period.end;

/** The days two periods share, or null if they share none. */
export function overlap(a: Period, b: Period): Period | null {
  const [, start] = [a.start, b.start].sort();
  const [end] = [a.end, b.end].sort();
  return start <= end ? { label: a.label, start, end } : null;
}

export function daysIn(period: Period): number {
  return daysBetween(period.start, period.end) + 1;
}

/** Days from one date to another, negative when the second is earlier. */
export function daysBetween(from: string, to: string): number {
  const milliseconds = toDate(to).getTime() - toDate(from).getTime();
  return milliseconds / 86_400_000;
}
