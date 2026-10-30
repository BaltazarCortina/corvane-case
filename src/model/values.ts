// Parsers for single values as they appear in the exports. Each returns null when the text is
// empty or not in a known format, so the caller decides whether that is an error.

import { MONTH_NAMES } from '../shared/calendar';

/** Parses `2024-04-01`, `04/01/2024` (month first) and `Apr 01, 2024` into ISO `YYYY-MM-DD`. */
export function parseDate(raw: string): string | null {
  const s = raw.trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return isoDate(Number(m[1]), Number(m[2]), Number(m[3]));
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return isoDate(Number(m[3]), Number(m[1]), Number(m[2]));
  m = s.match(/^([A-Z][a-z]{2}) (\d{1,2}), (\d{4})$/);
  const month = m ? MONTH_NAMES.indexOf(m[1]) + 1 : 0;
  if (m && month) return isoDate(Number(m[3]), month, Number(m[2]));
  return null;
}

/** Builds an ISO date, or null if the day does not exist in that month. */
function isoDate(year: number, month: number, day: number): string | null {
  const d = new Date(Date.UTC(year, month - 1, day));
  if (d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) return null;
  return d.toISOString().slice(0, 10);
}

/** Parses `$4,340.27`, `($1,212.32)` (accounting negative), `-120.50` and `3379.22`. */
export function parseMoney(raw: string): number | null {
  let s = raw.trim();
  let sign = 1;
  if (s.startsWith('(') && s.endsWith(')')) {
    sign = -1;
    s = s.slice(1, -1);
  }
  if (s.startsWith('-')) {
    sign = -sign;
    s = s.slice(1);
  }
  s = s.replace(/^\$/, '').replace(/,/g, '');
  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  return sign * Number(s);
}
