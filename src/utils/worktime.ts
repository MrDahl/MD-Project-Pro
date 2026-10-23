import type { DaySchedule, WeekSchedule } from "../types.ts";

export const DEFAULT_START = 7 * 60;
export const MINUTES_PER_DAY = 1440;

/** "07:30" -> 450 (null if unreadable). */
export function parseTime(s: string): number | null {
  const m = s.trim().match(/^(\d{1,2})[:.](\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]);
  const mi = Number(m[2]);
  return h <= 24 && mi < 60 && h * 60 + mi <= MINUTES_PER_DAY ? h * 60 + mi : null;
}

/** 450 -> "07:30" */
export function formatTime(min: number): string {
  const t = Math.max(0, Math.min(MINUTES_PER_DAY, Math.round(min)));
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
}

/** Working intervals of a day: [start, end] minus the breaks. */
export function windowsOf(d: DaySchedule): [number, number][] {
  const out: [number, number][] = [];
  let cur = d.start;
  const breaks = [...d.breaks].filter((b) => b.to > b.from).sort((a, b) => a.from - b.from);
  for (const b of breaks) {
    if (b.to <= cur) continue;
    if (b.from >= d.end) break;
    if (b.from > cur) out.push([cur, Math.min(b.from, d.end)]);
    cur = Math.max(cur, b.to);
  }
  if (cur < d.end) out.push([cur, d.end]);
  return out;
}

export const minutesOf = (d: DaySchedule): number => windowsOf(d).reduce((s, [a, b]) => s + (b - a), 0);
export const hoursOfDay = (d: DaySchedule | null | undefined): number => (d ? minutesOf(d) / 60 : 0);

/** The same schedule on Monday to Friday (+ optional Friday override and weekend). */
export function makeWeek(weekday: DaySchedule, friday?: DaySchedule | null, weekend?: DaySchedule | null): WeekSchedule {
  const clone = (d: DaySchedule | null | undefined): DaySchedule | null => (d ? { start: d.start, end: d.end, breaks: d.breaks.map((b) => ({ ...b })) } : null);
  return [clone(weekend), clone(weekday), clone(weekday), clone(weekday), clone(weekday), clone(friday === undefined ? weekday : friday), clone(weekend)];
}

/** A typical craftsman's week: 06:00-14:30 with 15 + 30 min breaks, shorter Friday. Used as the starting point in the editor. */
export function exampleWeek(): WeekSchedule {
  return makeWeek(
    { start: 6 * 60, end: 14 * 60 + 30, breaks: [{ from: 9 * 60, to: 9 * 60 + 15 }, { from: 11 * 60 + 30, to: 12 * 60 }] },
    { start: 6 * 60, end: 14 * 60, breaks: [{ from: 9 * 60, to: 9 * 60 + 15 }, { from: 11 * 60 + 30, to: 12 * 60 }] },
    null
  );
}

/** Average paid hours Monday-Friday (used as the "hours per day" number). */
export function weekdayAverageHours(w: WeekSchedule): number {
  const days = [1, 2, 3, 4, 5].map((i) => hoursOfDay(w[i]));
  const worked = days.filter((h) => h > 0);
  return worked.length ? worked.reduce((s, h) => s + h, 0) / worked.length : 0;
}

export function isValidWeek(w: unknown): w is WeekSchedule {
  return (
    Array.isArray(w) &&
    w.length === 7 &&
    w.every((d) => d === null || (typeof d === "object" && d !== null && Number.isFinite(d.start) && Number.isFinite(d.end) && d.end > d.start && Array.isArray(d.breaks)))
  );
}

export interface ResolvedDay {
  windows: [number, number][];
  /** Working minutes in the windows */
  minutes: number;
}

/**
 * How one weekday looks for a calendar. `week` undefined = the plain "N hours a day" calendar starting at 07:00.
 * Returns null on a day off. Weekend days that are off fall back to Monday's hours (they are only used when a task allows weekend work).
 */
export function resolveWeek(week: WeekSchedule | undefined, hoursPerDay: number): (ResolvedDay | null)[] {
  const plain: ResolvedDay = { windows: [[DEFAULT_START, DEFAULT_START + hoursPerDay * 60]], minutes: hoursPerDay * 60 };
  if (!week) return [plain, plain, plain, plain, plain, plain, plain];
  const base = (d: DaySchedule): ResolvedDay => {
    const windows = windowsOf(d);
    return { windows, minutes: windows.reduce((s, [a, b]) => s + (b - a), 0) };
  };
  const monday = week[1] ? base(week[1]) : [2, 3, 4, 5].map((i) => week[i]).find((d) => d) ? base([2, 3, 4, 5].map((i) => week[i]).find((d) => d)!) : plain;
  return week.map((d, i) => {
    if (d) return base(d);
    return i === 0 || i === 6 ? monday : null;
  });
}

/**
 * Which hours a day counts for in a weekend-aware way: weekend days that are "off" in the schedule use the fallback
 * only when work on weekends is allowed, which the caller checks.
 */
export function describeWeek(w: WeekSchedule): string {
  const fmt = (d: DaySchedule | null) => (d ? `${formatTime(d.start)}-${formatTime(d.end)}` : "fri");
  const hours = (d: DaySchedule | null) => hoursOfDay(d).toLocaleString("da-DK", { maximumFractionDigits: 2 });
  const mon = w[1];
  const fri = w[5];
  const same = JSON.stringify(mon) === JSON.stringify(fri);
  return same ? `Man-fre ${fmt(mon)} (${hours(mon)} t)` : `Man-tor ${fmt(mon)} (${hours(mon)} t), fre ${fmt(fri)} (${hours(fri)} t)`;
}
