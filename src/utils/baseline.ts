import type { Baseline, Task } from "../types.ts";
import { dayNumber } from "./scheduler.ts";

export type BaselineTask = Baseline["tasks"][number];

/** Snapshot of the calculated plan. Tasks that are not scheduled are left out. */
export function makeBaseline(tasks: Task[], endDate: string | null, totalCost: number, now: Date = new Date()): Baseline {
  return {
    savedAt: now.toISOString(),
    endDate,
    totalCost,
    tasks: tasks
      .filter((t) => t.calcStart && t.calcEnd)
      .map((t) => ({ id: t.id, start: t.calcStart!, end: t.calcEnd!, cost: t.calcCost || 0 })),
  };
}

export function baselineById(b: Baseline | null | undefined): Map<string, BaselineTask> {
  const m = new Map<string, BaselineTask>();
  if (b) for (const t of b.tasks) if (!m.has(t.id)) m.set(t.id, t);
  return m;
}

/** Calendar days the task's end has moved compared with the baseline (positive = later). */
export function endDeviationDays(task: Pick<Task, "calcEnd">, base: BaselineTask | undefined): number | null {
  if (!base) return null;
  const now = dayNumber(task.calcEnd);
  const then = dayNumber(base.end);
  return now === null || then === null ? null : now - then;
}

/** Days between two dates (b - a), or null if either is missing/invalid. */
export function daysBetween(a: string | null | undefined, b: string | null | undefined): number | null {
  const x = dayNumber(a);
  const y = dayNumber(b);
  return x === null || y === null ? null : y - x;
}

/** Accepts whatever was saved and returns a well-formed baseline or null. */
export function normalizeBaseline(raw: unknown): Baseline | null {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  if (!Array.isArray(r.tasks)) return null;
  const tasks: Baseline["tasks"] = [];
  for (const t of r.tasks) {
    if (typeof t !== "object" || t === null) continue;
    const x = t as Record<string, unknown>;
    if (typeof x.id !== "string" || dayNumber(x.start as string) === null || dayNumber(x.end as string) === null) continue;
    tasks.push({ id: x.id, start: x.start as string, end: x.end as string, cost: Number(x.cost) || 0 });
  }
  return {
    savedAt: typeof r.savedAt === "string" ? r.savedAt : new Date(0).toISOString(),
    endDate: typeof r.endDate === "string" && dayNumber(r.endDate) !== null ? r.endDate : null,
    totalCost: Number(r.totalCost) || 0,
    tasks,
  };
}
