import type { Task, Trade, Settings, Stage, WeatherDelay, Holiday } from "../types.ts";
import { taskLinks } from "./links.ts";

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

/** True if the predecessor links contain a loop (Kahn's algorithm: iterative, safe for very long chains). */
export function detectCycle(tasks: Task[]): boolean {
  const byId = new Map<string, Task>();
  for (const t of tasks) if (!byId.has(t.id)) byId.set(t.id, t);

  const indegree = new Map<Task, number>();
  const children = new Map<Task, Task[]>();
  for (const t of tasks) indegree.set(t, 0);
  for (const t of tasks) {
    const seen = new Set<Task>();
    for (const l of taskLinks(t)) {
      const pred = byId.get(l.taskId);
      if (!pred || seen.has(pred)) continue; // unknown predecessors are ignored
      seen.add(pred);
      indegree.set(t, indegree.get(t)! + 1);
      const list = children.get(pred);
      if (list) list.push(t);
      else children.set(pred, [t]);
    }
  }

  const ready: Task[] = [];
  for (const [t, n] of indegree) if (n === 0) ready.push(t);
  let done = 0;
  while (ready.length > 0) {
    const t = ready.pop()!;
    done++;
    for (const c of children.get(t) || []) {
      const left = indegree.get(c)! - 1;
      indegree.set(c, left);
      if (left === 0) ready.push(c);
    }
  }
  return done < tasks.length;
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
    assignmentCosts: {},
    roleCosts: {},
    roleHours: {},
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
      scheduleError: "Projektets startdato er ikke angivet. Gå til fanen Projekt & kalender eller giv en opgave en startdato.",
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

  // Predecessors must be regular tasks; links to recurring/unknown tasks are ignored
  const linksOf = new Map<Task, { pred: Task; type: "FS" | "SS"; lag: number }[]>();
  for (const t of nonRecurringTasks) {
    const list: { pred: Task; type: "FS" | "SS"; lag: number }[] = [];
    const seen = new Set<Task>();
    for (const l of taskLinks(t)) {
      const pred = taskById.get(l.taskId);
      if (pred && !seen.has(pred)) {
        seen.add(pred);
        list.push({ pred, type: l.type, lag: l.lag });
      }
    }
    linksOf.set(t, list);
  }

  // Start/end day per task, and the predecessors that decided each task's start (for the critical path)
  const startDayOf = new Map<Task, number>();
  const endDay = new Map<Task, number>();
  const drivers = new Map<Task, Task[]>();

  // Process predecessors before successors (topological order; no cycles at this point)
  const waiting = new Map<Task, number>();
  const successors = new Map<Task, Task[]>();
  for (const t of nonRecurringTasks) {
    const list = linksOf.get(t)!;
    waiting.set(t, list.length);
    for (const { pred } of list) {
      const s = successors.get(pred);
      if (s) s.push(t);
      else successors.set(pred, [t]);
    }
  }
  const order: Task[] = [];
  const ready = nonRecurringTasks.filter((t) => waiting.get(t) === 0).reverse();
  while (ready.length > 0) {
    const t = ready.pop()!;
    order.push(t);
    for (const c of successors.get(t) || []) {
      const left = waiting.get(c)! - 1;
      waiting.set(c, left);
      if (left === 0) ready.push(c);
    }
  }

  const hours = settings.workHoursPerDay;

  for (const task of order) {
    // Earliest start allowed by the predecessors: FS = day after the predecessor ends, SS = the day it starts, plus lag
    let depStart: number | null = null;
    let driving: Task[] = [];
    for (const { pred, type, lag } of linksOf.get(task)!) {
      if (!endDay.has(pred)) continue;
      const limit = type === "SS" ? startDayOf.get(pred)! + lag : endDay.get(pred)! + 1 + lag;
      if (depStart === null || limit > depStart) {
        depStart = limit;
        driving = [pred];
      } else if (limit === depStart) {
        driving.push(pred);
      }
    }
    drivers.set(task, driving);

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
    const assignmentCosts: { [aid: string]: number } = {};
    const roleCosts: { [rid: string]: number } = {};
    const roleHours: { [rid: string]: number } = {};

    if (!task.isMilestone) {
      const assignments = task.assignments || [];
      // Trades on the task: the chosen ones plus any trade that only appears in a crew
      const tradeIdSet = new Set(task.tradeIds || []);
      for (const a of assignments) tradeIdSet.add(a.tradeId);
      const activeTrades = [...tradeIdSet].map((tid) => tradeById.get(tid)).filter((tr): tr is Trade => !!tr);
      const crewOf = new Map<string, typeof assignments>();
      for (const a of assignments) {
        const tr = tradeById.get(a.tradeId);
        if (!tr || tr.isFixedPrice) continue; // fixed price trades ignore crews
        const l = crewOf.get(a.tradeId);
        if (l) l.push(a);
        else crewOf.set(a.tradeId, [a]);
      }

      const supplement = (day: number, tr: Trade): number =>
        cal.isHoliday(day) ? 1 + tr.holidaySupplement / 100 : isWeekendDay(day) ? 1 + tr.weekendSupplement / 100 : 1;

      const addDay = (day: number) => {
        for (const tr of activeTrades) {
          if (tr.isFixedPrice) continue;
          const sup = supplement(day, tr);
          const crews = crewOf.get(tr.id);
          if (!crews) {
            tradeCosts[tr.id] = (tradeCosts[tr.id] || 0) + hours * tr.rate * sup;
            continue;
          }
          const roleById = new Map((tr.roles || []).map((r) => [r.id, r]));
          for (const a of crews) {
            const share = (a.percent ?? 100) / 100;
            for (const c of a.crew) {
              const role = roleById.get(c.roleId);
              if (!role || !(c.count > 0)) continue;
              const h = hours * share * c.count;
              const cost = h * role.rate * sup;
              tradeCosts[tr.id] = (tradeCosts[tr.id] || 0) + cost;
              assignmentCosts[a.id] = (assignmentCosts[a.id] || 0) + cost;
              roleCosts[role.id] = (roleCosts[role.id] || 0) + cost;
              roleHours[role.id] = (roleHours[role.id] || 0) + h;
            }
          }
        }
      };

      for (const tr of activeTrades) tradeCosts[tr.id] = 0;
      addDay(start);

      let allocated = 1;
      while (allocated < task.duration) {
        end++;
        if (canWork(end)) {
          allocated++;
          addDay(end);
        }
      }

      for (const tr of activeTrades) if (tr.isFixedPrice) tradeCosts[tr.id] = tr.rate;
      for (const tid in tradeCosts) taskCost += tradeCosts[tid];
    }

    startDayOf.set(task, start);
    endDay.set(task, end);
    task.calcStart = dayToStr(start);
    task.calcEnd = dayToStr(end);
    task.calcCost = taskCost;
    task.tradeCosts = tradeCosts;
    task.assignmentCosts = assignmentCosts;
    task.roleCosts = roleCosts;
    task.roleHours = roleHours;
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
      for (const pred of drivers.get(current) || []) if (!pred.isCritical) queue.push(pred);
    }
  }

  return { tasks, projectEndDate, projectTotalCost, scheduleError: null, startDateWarning };
}
