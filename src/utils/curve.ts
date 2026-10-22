import type { Baseline, Task } from "../types.ts";
import { dayNumber } from "./scheduler.ts";

/** A cost spread evenly over the calendar days [start, end] (day numbers). */
export interface CostItem {
  start: number;
  end: number;
  cost: number;
}

export function costItemsFromTasks(tasks: Task[]): CostItem[] {
  const items: CostItem[] = [];
  for (const t of tasks) {
    const s = dayNumber(t.calcStart);
    const e = dayNumber(t.calcEnd);
    if (s !== null && e !== null && e >= s && (t.calcCost || 0) > 0) items.push({ start: s, end: e, cost: t.calcCost || 0 });
  }
  return items;
}

export function costItemsFromBaseline(b: Baseline): CostItem[] {
  const items: CostItem[] = [];
  for (const t of b.tasks) {
    const s = dayNumber(t.start);
    const e = dayNumber(t.end);
    if (s !== null && e !== null && e >= s && t.cost > 0) items.push({ start: s, end: e, cost: t.cost });
  }
  return items;
}

export interface CostCurve {
  /** Day number of values[0]. */
  from: number;
  /** Accumulated cost at the end of each day from `from`. */
  values: number[];
}

/** Accumulated cost per day (the "S-curve"). Empty when there is nothing to show. */
export function buildCostCurve(items: CostItem[], from?: number, to?: number): CostCurve {
  if (items.length === 0) return { from: from ?? 0, values: [] };
  const lo = from ?? Math.min(...items.map((i) => i.start));
  const hi = to ?? Math.max(...items.map((i) => i.end));
  const n = hi - lo + 1;
  if (n <= 0) return { from: lo, values: [] };

  // Difference array of cost per day, then a running sum
  const perDay = new Float64Array(n + 1);
  let before = 0; // cost of days that lie before `lo`
  for (const it of items) {
    const rate = it.cost / (it.end - it.start + 1);
    const a = Math.max(it.start, lo);
    const b = Math.min(it.end, hi);
    if (it.start < lo) before += rate * (Math.min(it.end, lo - 1) - it.start + 1);
    if (a <= b) {
      perDay[a - lo] += rate;
      perDay[b - lo + 1] -= rate;
    }
  }
  const values: number[] = new Array(n);
  let rate = 0;
  let total = before;
  for (let i = 0; i < n; i++) {
    rate += perDay[i];
    total += rate;
    values[i] = total;
  }
  return { from: lo, values };
}

/** Keeps at most `max` evenly spaced points (always including the first and last). */
export function sampleIndices(length: number, max: number): number[] {
  if (length <= 0) return [];
  if (length <= max) return Array.from({ length }, (_, i) => i);
  const out: number[] = [];
  for (let k = 0; k < max; k++) out.push(Math.round((k * (length - 1)) / (max - 1)));
  return out;
}
