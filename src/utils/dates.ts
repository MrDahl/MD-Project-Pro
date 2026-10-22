import { dayNumber, dayToStr, weekdayOf } from "./scheduler.ts";

/** Local calendar date of `now` as "YYYY-MM-DD". */
export function todayStr(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Adds (or subtracts) whole calendar days to a "YYYY-MM-DD" date. */
export function addDaysStr(date: string, days: number): string {
  const n = dayNumber(date);
  return n === null ? date : dayToStr(n + days);
}

/** Today if it is a Monday, otherwise the coming Monday. */
export function nextMonday(now: Date = new Date()): string {
  const today = dayNumber(todayStr(now))!;
  const wd = weekdayOf(today); // 0 = Sunday
  return dayToStr(today + ((8 - wd) % 7));
}

/** Day number of the Monday that starts ISO week `week` of `year`. */
function isoWeekMonday(year: number, week: number): number {
  const jan4 = dayNumber(`${year}-01-04`)!;
  const week1Monday = jan4 - ((weekdayOf(jan4) + 6) % 7);
  return week1Monday + (week - 1) * 7;
}

/** Monday-Friday dates of ISO weeks fromWeek..toWeek (inclusive) - e.g. the building industry summer break. */
export function industryHolidayDays(year: number, fromWeek = 29, toWeek = 31): string[] {
  const days: string[] = [];
  for (let w = fromWeek; w <= toWeek; w++) {
    const monday = isoWeekMonday(year, w);
    for (let i = 0; i < 5; i++) days.push(dayToStr(monday + i));
  }
  return days;
}

export interface StageDates {
  prepStartDate: string;
  prepEndDate: string;
  rawStartDate: string;
  rawEndDate: string;
  finishStartDate: string;
  finishEndDate: string;
}

/** Suggested stage dates relative to the project start: 2 weeks preparation, 6 weeks shell, ~3 weeks finish. */
export function defaultStageDates(start: string): StageDates {
  return {
    prepStartDate: start,
    prepEndDate: addDaysStr(start, 13),
    rawStartDate: addDaysStr(start, 14),
    rawEndDate: addDaysStr(start, 55),
    finishStartDate: addDaysStr(start, 56),
    finishEndDate: addDaysStr(start, 74),
  };
}
