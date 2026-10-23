import type { Task } from "../types.ts";

/** Removes calculated fields so a task can be stored as plain input data. */
export function stripCalculated(task: Task): Task {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { calcStart, calcEnd, calcCost, isCritical, tradeCosts, assignmentCosts, roleCosts, roleHours, calcStartMin, calcEndMin, calcHours, occurrences, ...rest } = task;
  return rest;
}

const hoursText = (h: number) => `${h.toLocaleString("da-DK", { maximumFractionDigits: 2 })} ${h === 1 ? "time" : "timer"}`;

/** "3 arbejdsdage" or "4 timer" */
export function durationText(t: Pick<Task, "duration" | "durationHours" | "isMilestone">): string {
  if (t.isMilestone) return "Milepæl";
  if (t.durationHours) return hoursText(t.durationHours);
  return `${t.duration} ${t.duration === 1 ? "arbejdsdag" : "arbejdsdage"}`;
}

const clock = (min: number): string => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(Math.round(min % 60)).padStart(2, "0")}`;

/** "kl. 07:00-11:00" for hour-based tasks on one day, "07:00 - 09:36" across days; "" for day-based tasks. */
export function clockText(t: Pick<Task, "durationHours" | "calcStart" | "calcEnd" | "calcStartMin" | "calcEndMin" | "isMilestone">): string {
  if (!t.durationHours || t.isMilestone || t.calcStartMin === undefined || t.calcEndMin === undefined) return "";
  return t.calcStart === t.calcEnd ? `kl. ${clock(t.calcStartMin)}-${clock(t.calcEndMin)}` : `kl. ${clock(t.calcStartMin)} til ${clock(t.calcEndMin)}`;
}
