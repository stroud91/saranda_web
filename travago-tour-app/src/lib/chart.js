// Small sums behind the Host desk chart, kept apart so they can be tested.

/** A round number at or above `v` whose half is whole, so the axis reads 0 / 10 / 20. */
export function axisTop(v) {
  if (!(v > 4)) return 4;
  if (v <= 10) return 10;
  const pow = 10 ** Math.floor(Math.log10(v));
  return [1, 2, 4, 5, 10].map((m) => m * pow).find((top) => v <= top);
}

/**
 * Which days get a date under the chart: every day of a week, otherwise five
 * spread evenly; fewer when the chart is too narrow for them (`room` = how many fit).
 */
export function dateTicks(n, room = 7) {
  const count = Math.max(2, Math.min(n <= 7 ? n : 5, room));
  if (n <= count) return Array.from({ length: n }, (_, i) => i);
  return [...new Set(Array.from({ length: count }, (_, k) => Math.round((k * (n - 1)) / (count - 1))))];
}
