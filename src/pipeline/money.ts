// Money arithmetic in whole cents, so that adding thousands of amounts does not drift from the
// totals the exports state.

export function sumMoney(amounts: number[]): number {
  let cents = 0;
  for (const amount of amounts) cents += Math.round(amount * 100);
  return cents / 100;
}
