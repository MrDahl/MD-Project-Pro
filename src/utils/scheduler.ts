import type { Task, Trade, Settings, Stage, WeatherDelay, Holiday } from "../types.ts";

/*
 * Dates are handled internally as "day numbers" (whole days since 1970-01-01, UTC).
 * That avoids Date allocation and daylight-saving drift in the hot loops.
 */
const MS_PER_DAY = 86_400_000;

/** "YYYY-MM-DD" -> day number, or null if the string is not a valid calendar date. */
export function dayNumber(dateStr: string | null | undefined): number | null {
  if (!dateStr || dateStr.length < 10) return null;
  const y = Number(dateStr.slice(0, 4));
  const m = Number(dateStr.slice(5, 7));
  const d = Number(dateStr.slice(8, 10));
  if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) return null;
  const n = Math.floor(Date.UTC(y, m - 1, d) / MS_PER_DAY);
  return Number.isNaN(n) || dayToStr(n) !== dateStr.slice(0, 10) ? null : n;
}

/** Day number -> "YYYY-MM-DD". */
export function dayToStr(day: number): string {
  return new Date(day * MS_PER_DAY).toISOString().slice(0, 10);
}

/** 0 = Sunday ... 6 = Saturday. */
export function weekdayOf(day: number): number {
  return (((day + 4) % 7) + 7) % 7;
}

export function isWeekendDay(day: number): boolean {
  const w = weekdayOf(day);
  return w === 0 || w === 6;
}

/** Fast day lookups for holidays and weather delays. Build once per calculation/render. */
export interface Calendar {
  holidays: Map<number, string>;
  /** Merged, sorted [firstDay, lastDay] intervals of weather delays. */
  weatherRanges: [number, number][];
  isHoliday(day: number): boolean;
  isWeatherDay(day: number): boolean;
  /** Weekend/holiday rules only (weather is handled by the caller). */
  isWorkingDay(day: number, allowWeekend: boolean, allowHoliday: boolean): boolean;
}

export function buildCalendar(holidays: Holiday[] = [], weatherDelays: WeatherDelay[] = []): Calendar {
  const holidayMap = new Map<number, string>();
  for (const h of holidays) {
    if (!h) continue;
    const date = typeof h === "string" ? (h as string) : h.date;
    const day = dayNumber(date);
    if (day !== null && !holidayMap.has(day)) holidayMap.set(day, typeof h === "string" ? "" : h.name);
  }

  // Merge weather delay ranges into sorted, non-overlapping intervals for binary search.
  const ranges: [number, number][] = [];
  for (const w of weatherDelays) {
    const s = dayNumber(w.startDate);
    const e = dayNumber(w.endDate);
    if (s !== null && e !== null && s <= e) ranges.push([s, e]);
  }
  ranges.sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [];
  for (const r of ranges) {
    const last = merged[merged.length - 1];
    if (last && r[0] <= last[1] + 1) last[1] = Math.max(last[1], r[1]);
    else merged.push([r[0], r[1]]);
  }

  const isWeatherDay = (day: number): boolean => {
    let lo = 0;
    let hi = merged.length - 1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (day < merged[mid][0]) hi = mid - 1;
      else if (day > merged[mid][1]) lo = mid + 1;
      else return true;
    }
    return false;
  };

  return {
    holidays: holidayMap,
    weatherRanges: merged,
    isHoliday: (day) => holidayMap.has(day),
    isWeatherDay,
    isWorkingDay: (day, allowWeekend, allowHoliday) => {
      if (!allowHoliday && holidayMap.has(day)) return false;
      if (!allowWeekend && isWeekendDay(day)) return false;
      return true;
    },
  };
}

/** True if the dependency chain contains a loop (iterative, safe for very long chains). */
export function detectCycle(tasks: Task[]): boolean {
  const parentOf = new Map<string, string | null>();
  for (const t of tasks) parentOf.set(t.id, t.dependencyId);

  // 0/undefined = unvisited, 1 = on the current path, 2 = fully checked
  const state = new Map<string, 1 | 2>();

  for (const t of tasks) {
    const path: string[] = [];
    let cur: string | null | undefined = t.id;
    while (cur && !state.has(cur)) {
      state.set(cur, 1);
      path.push(cur);
      cur = parentOf.get(cur) || null;
    }
    if (cur && state.get(cur) === 1) return true;
    for (const id of path) state.set(id, 2);
  }
  return false;
}

export interface ScheduleResult {
  tasks: Task[];
  projectEndDate: string | null;
  projectTotalCost: number;
  scheduleError: string | null;
  startDateWarning: string | null;
}

export function calculateSchedule(
  tasksInput: Task[],
  trades: Trade[],
  holidays: Holiday[],
  settings: Settings,
  projectStartDate: string,
  stagesInput: Stage[] = [],
  weatherDelays: WeatherDelay[] = []
): ScheduleResult {
  let startDateWarning: string | null = null;

  // Fresh copies with cleared metrics
  const tasks: Task[] = tasksInput.map((t) => ({
    ...t,
    calcStart: null,
    calcEnd: null,
    calcCost: 0,
    isCritical: false,
    tradeCosts: {} as { [tradeId: string]: number },
    occurrences: [] as string[],
  }));

  if (tasks.length === 0) {
    return { tasks, projectEndDate: null, projectTotalCost: 0, scheduleError: null, startDateWarning };
  }

  if (detectCycle(tasks)) {
    return {
      tasks,
      projectEndDate: null,
      projectTotalCost: 0,
      scheduleError:
        "Rundgang / Cyklus opdaget: Nogle opgaver afhænger af hinanden i en lukket cirkel. Fjern afhængighederne for at beregne.",
      startDateWarning,
    };
  }

  const nonRecurringTasks = tasks.filter((t) => !t.isRecurring);

  // Earliest manual start among regular tasks, or fall back to the project start date
  let earliestTaskStart: string | null = null;
  for (const t of nonRecurringTasks) {
    if (t.manualStart && (earliestTaskStart === null || t.manualStart < earliestTaskStart)) {
      earliestTaskStart = t.manualStart;
    }
  }

  let effectiveStartDate = projectStartDate;
  if (effectiveStartDate) {
    if (earliestTaskStart && earliestTaskStart < effectiveStartDate) {
      startDateWarning = `Bemærk: Mindst én opgave har en startdato (${earliestTaskStart}), der ligger før projektets startdato (${effectiveStartDate}).`;
    }
  } else if (earliestTaskStart) {
    effectiveStartDate = earliestTaskStart;
  } else {
    return {
      tasks,
      projectEndDate: null,
      projectTotalCost: 0,
      scheduleError: "Projektets startdato er ikke angivet. Gå til Indstillinger eller giv en opgave en startdato.",
      startDateWarning,
    };
  }

  const cal = buildCalendar(holidays, weatherDelays);
  const effectiveStartDay = dayNumber(effectiveStartDate);

  // Lookups (first match wins, like Array.find)
  const tradeById = new Map<string, Trade>();
  for (const tr of trades) if (!tradeById.has(tr.id)) tradeById.set(tr.id, tr);
  const taskById = new Map<string, Task>();
  for (const t of nonRecurringTasks) if (!taskById.has(t.id)) taskById.set(t.id, t);

  // Predecessor must be a regular task; links to recurring/unknown tasks are ignored
  const predecessorOf = (t: Task): Task | undefined => (t.dependencyId ? taskById.get(t.dependencyId) : undefined);

  // End day per task (aligned with the task objects)
  const endDay = new Map<Task, number>();

  // Process predecessors before successors (no cycles at this point)
  const processed = new Set<Task>();
  const order: Task[] = [];
  for (const t of nonRecurringTasks) {
    const chain: Task[] = [];
    let cur: Task | undefined = t;
    while (cur && !processed.has(cur)) {
      processed.add(cur);
      chain.push(cur);
      cur = predecessorOf(cur);
    }
    for (let i = chain.length - 1; i >= 0; i--) order.push(chain[i]);
  }

  const hours = settings.workHoursPerDay;

  for (const task of order) {
    let depStart: number | null = null;
    const pred = predecessorOf(task);
    if (pred && endDay.has(pred)) depStart = endDay.get(pred)! + 1; // next calendar day

    const manStart = task.manualStart ? dayNumber(task.manualStart) : null;

    let start = effectiveStartDay ?? 0;
    if (depStart !== null && manStart !== null) start = Math.max(depStart, manStart);
    else if (manStart !== null) start = manStart;
    else if (depStart !== null) start = depStart;

    const weatherSensitive = !task.weatherIndependent;
    const canWork = (day: number) =>
      cal.isWorkingDay(day, task.allowWeekend, task.allowHoliday) && (!weatherSensitive || !cal.isWeatherDay(day));

    while (!canWork(start)) start++;

    let end = start;
    let taskCost = 0;
    const tradeCosts: { [tid: string]: number } = {};

    if (!task.isMilestone) {
      const activeTrades = (task.tradeIds || [])
        .map((tid) => tradeById.get(tid))
        .filter((tr): tr is Trade => !!tr);

      const dayCost = (day: number, tr: Trade): number => {
        let cost = hours * tr.rate;
        if (cal.isHoliday(day)) cost += cost * (tr.holidaySupplement / 100);
        else if (isWeekendDay(day)) cost += cost * (tr.weekendSupplement / 100);
        return cost;
      };

      for (const tr of activeTrades) tradeCosts[tr.id] = tr.isFixedPrice ? tr.rate : dayCost(start, tr);

      let allocated = 1;
      while (allocated < task.duration) {
        end++;
        if (canWork(end)) {
          allocated++;
          for (const tr of activeTrades) {
            if (!tr.isFixedPrice) tradeCosts[tr.id] = (tradeCosts[tr.id] || 0) + dayCost(end, tr);
          }
        }
      }

      for (const tr of activeTrades) if (tr.isFixedPrice) tradeCosts[tr.id] = tr.rate;
      for (const tid in tradeCosts) taskCost += tradeCosts[tid];
    }

    endDay.set(task, end);
    task.calcStart = dayToStr(start);
    task.calcEnd = dayToStr(end);
    task.calcCost = taskCost;
    task.tradeCosts = tradeCosts;
  }

  // Project end = latest end among regular tasks
  let maxEndDate: string | null = null;
  for (const t of nonRecurringTasks) {
    if (t.calcEnd && (!maxEndDate || t.calcEnd > maxEndDate)) maxEndDate = t.calcEnd;
  }
  const projectEndDate = maxEndDate || effectiveStartDate;

  // Recurring tasks span the project (or chosen stages)
  const projectEndDay = dayNumber(projectEndDate);
  for (const task of tasks) {
    if (!task.isRecurring) continue;

    let rangeStart: string | null | undefined = task.manualStart || effectiveStartDate;
    let rangeEnd: string | null | undefined = projectEndDate;

    if (task.recurringRangeType === "stages" && task.recurringStageIds && task.recurringStageIds.length > 0) {
      const selected = (stagesInput || []).filter((s) => task.recurringStageIds?.includes(s.id));
      if (selected.length > 0) {
        const starts = selected.map((s) => s.startDate).sort();
        const ends = selected.map((s) => s.endDate).sort();
        rangeStart = starts[0];
        rangeEnd = ends[ends.length - 1];
      }
    }

    const occurrences: string[] = [];
    const startDay = dayNumber(rangeStart);
    const stopDay = rangeEnd === projectEndDate ? projectEndDay : dayNumber(rangeEnd);

    if (startDay !== null && stopDay !== null) {
      const interval = Math.max(1, Math.trunc(task.recurringInterval || 7) || 7);
      const weatherSensitive = !task.weatherIndependent;
      for (let curr = startDay; curr <= stopDay; curr += interval) {
        let actual = curr;
        while (
          !cal.isWorkingDay(actual, task.allowWeekend, task.allowHoliday) ||
          (weatherSensitive && cal.isWeatherDay(actual))
        ) {
          actual++;
        }
        if (actual <= stopDay) occurrences.push(dayToStr(actual));
      }
    }

    task.occurrences = occurrences;
    task.calcStart = occurrences[0] || null;
    task.calcEnd = occurrences[occurrences.length - 1] || null;
    task.calcCost = occurrences.length * (task.recurringPrice || 0);
    task.tradeCosts = {};
  }

  let projectTotalCost = 0;
  for (const t of tasks) projectTotalCost += t.calcCost || 0;

  // Critical path: walk back from every task that ends on the project end date
  if (maxEndDate) {
    const queue = nonRecurringTasks.filter((t) => t.calcEnd === maxEndDate);
    while (queue.length > 0) {
      const current = queue.pop()!;
      current.isCritical = true;
      const pred = predecessorOf(current);
      if (pred && !pred.isCritical) queue.push(pred);
    }
  }

  return { tasks, projectEndDate, projectTotalCost, scheduleError: null, startDateWarning };
}
