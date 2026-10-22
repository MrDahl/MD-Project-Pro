import type { Task, Stage, Trade } from "../../types.ts";
import { dayNumber, type Calendar } from "../../utils/scheduler.ts";
export { stripCalculated } from "../../utils/tasks.ts";

export type Zoom = "day" | "week" | "month";

/** Width of one day column per zoom level (px). */
export const ZOOM_COL_W: Record<Zoom, number> = { day: 48, week: 24, month: 10 };

/** Layout constants (px). Every row is ROW_H tall. */
export const ROW_H = 56;
export const HEADER_H = 56;
export const LABEL_W = 208;
export const LABEL_W_COLLAPSED = 44;

export type ScopeType = "all" | "stage" | "month" | "year";

export interface FilterState {
  scope: ScopeType;
  stageId: string;
  monthStr: string;
  yearVal: number;
}

export interface Segment {
  startIndex: number;
  endIndex: number;
  type: "work" | "rest";
}

export const isScheduled = (t: Task): boolean => !!(t.calcStart && t.calcEnd);

/** Absolute project bounds (no padding) used to build the month/year pickers. */
export function projectBounds(tasks: Task[], projectStartDate: string): { min: number; max: number } {
  let min = dayNumber(projectStartDate || "2026-06-01") ?? 0;
  let max = dayNumber(projectStartDate || "2026-06-15") ?? 0;
  for (const t of tasks) {
    const s = dayNumber(t.calcStart);
    const e = dayNumber(t.calcEnd);
    if (s !== null && s < min) min = s;
    if (e !== null && e > max) max = e;
  }
  return { min, max };
}

export function monthsBetween(minDay: number, maxDay: number): { val: string; label: string }[] {
  const list: { val: string; label: string }[] = [];
  const a = new Date(minDay * 86_400_000);
  const b = new Date(maxDay * 86_400_000);
  let y = a.getUTCFullYear();
  let m = a.getUTCMonth();
  const endY = b.getUTCFullYear();
  const endM = b.getUTCMonth();
  while (y < endY || (y === endY && m <= endM)) {
    const label = new Date(y, m, 1).toLocaleDateString("da-DK", { month: "long", year: "numeric" });
    list.push({ val: `${y}-${String(m + 1).padStart(2, "0")}`, label: label.charAt(0).toUpperCase() + label.slice(1) });
    m++;
    if (m > 11) {
      m = 0;
      y++;
    }
  }
  return list;
}

export function yearsBetween(minDay: number, maxDay: number): number[] {
  const first = new Date(minDay * 86_400_000).getUTCFullYear();
  const last = new Date(maxDay * 86_400_000).getUTCFullYear();
  const list: number[] = [];
  for (let y = first; y <= last; y++) list.push(y);
  return list;
}

/** The inclusive day range shown for the chosen focus area. */
export function computeViewRange(
  scheduled: Task[],
  projectStartDate: string,
  stages: Stage[],
  filter: FilterState
): { minDay: number; maxDay: number } {
  const fallback = () => ({
    minDay: (dayNumber(projectStartDate || "2026-06-01") ?? 0) - 2,
    maxDay: (dayNumber(projectStartDate || "2026-06-15") ?? 0) + 5,
  });

  if (filter.scope === "stage") {
    const stage = stages.find((s) => s.id === filter.stageId);
    const s = stage ? dayNumber(stage.startDate) : null;
    const e = stage ? dayNumber(stage.endDate) : null;
    if (s !== null && e !== null) return { minDay: s - 2, maxDay: e + 4 };
    return fallback();
  }

  if (filter.scope === "month") {
    if (filter.monthStr) {
      const [y, m] = filter.monthStr.split("-").map(Number);
      return {
        minDay: Math.floor(Date.UTC(y, m - 1, 1) / 86_400_000),
        maxDay: Math.floor(Date.UTC(y, m, 0) / 86_400_000),
      };
    }
    return fallback();
  }

  if (filter.scope === "year") {
    const yr = filter.yearVal || new Date().getFullYear();
    return {
      minDay: Math.floor(Date.UTC(yr, 0, 1) / 86_400_000),
      maxDay: Math.floor(Date.UTC(yr, 11, 31) / 86_400_000),
    };
  }

  let min = dayNumber(projectStartDate || "2026-06-01") ?? 0;
  let max = dayNumber(projectStartDate || "2026-06-15") ?? 0;
  for (const t of scheduled) {
    const s = dayNumber(t.calcStart);
    const e = dayNumber(t.calcEnd);
    if (s !== null && s < min) min = s;
    if (e !== null && e > max) max = e;
  }
  return { minDay: min - 2, maxDay: max + 5 };
}

/**
 * Splits a task's span (clipped to the visible range) into consecutive solid work blocks
 * and dotted rest blocks. Indexes are columns relative to minDay.
 */
export function getTaskSegments(task: Task, minDay: number, maxDay: number, cal: Calendar): Segment[] {
  const segments: Segment[] = [];
  const s = dayNumber(task.calcStart);
  const e = dayNumber(task.calcEnd);
  if (s === null || e === null) return segments;

  const from = Math.max(s, minDay);
  const to = Math.min(e, maxDay);
  let current: Segment | null = null;

  for (let day = from; day <= to; day++) {
    const isWork =
      cal.isWorkingDay(day, task.allowWeekend, task.allowHoliday) && (task.weatherIndependent || !cal.isWeatherDay(day));
    const type = isWork ? "work" : "rest";
    const idx = day - minDay;
    if (!current) current = { startIndex: idx, endIndex: idx, type };
    else if (current.type === type) current.endIndex = idx;
    else {
      segments.push(current);
      current = { startIndex: idx, endIndex: idx, type };
    }
  }
  if (current) segments.push(current);
  return segments;
}

export function multiColorGradient(taskTradeIds: string[] | undefined, tradeById: Map<string, Trade>): string {
  const valid = (taskTradeIds || []).filter((id) => tradeById.has(id));
  if (valid.length === 0) return "#475569";
  if (valid.length === 1) return tradeById.get(valid[0])!.color || "#475569";

  const pct = 100 / valid.length;
  const stops: string[] = [];
  valid.forEach((id, i) => {
    const color = tradeById.get(id)!.color || "#475569";
    stops.push(`${color} ${i * pct}%`, `${color} ${(i + 1) * pct}%`);
  });
  return `linear-gradient(90deg, ${stops.join(", ")})`;
}

/** Cheap, order-preserving id -> object lookup (first match wins, like Array.find). */
export function indexBy<T extends { id: string }>(items: T[]): Map<string, T> {
  const map = new Map<string, T>();
  for (const it of items) if (!map.has(it.id)) map.set(it.id, it);
  return map;
}
