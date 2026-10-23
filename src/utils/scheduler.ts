import type { Task, Trade, Settings, Stage, WeatherDelay, Holiday, WeekSchedule } from "../types.ts";
import { DEFAULT_START, MINUTES_PER_DAY, isValidWeek, resolveWeek, type ResolvedDay } from "./worktime.ts";
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
    calcStartMin: undefined,
    calcEndMin: undefined,
    calcHours: undefined,
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
  const EPS = 1e-6;

  // Working hours per weekday for a calendar (project or trade), resolved once
  const resolvedCache = new Map<WeekSchedule | undefined, (ResolvedDay | null)[]>();
  const resolved = (week: WeekSchedule | undefined): (ResolvedDay | null)[] => {
    let r = resolvedCache.get(week);
    if (!r) {
      r = resolveWeek(week && isValidWeek(week) ? week : undefined, hours);
      resolvedCache.set(week, r);
    }
    return r;
  };

  // Position on the clock: minutes since 1970-01-01 00:00 (day * 1440 + minute of day)
  const startT = new Map<Task, number>();
  const endT = new Map<Task, number>();

  for (const task of order) {
    const hourMode = !task.isMilestone && (task.durationHours ?? 0) > 0;

    // The task's working calendar: the first of its trades with its own hours, otherwise the project's
    const assignments = task.assignments || [];
    const tradeIdSet = new Set(task.tradeIds || []);
    for (const a of assignments) tradeIdSet.add(a.tradeId);
    const activeTrades = [...tradeIdSet].map((tid) => tradeById.get(tid)).filter((tr): tr is Trade => !!tr);
    const week = activeTrades.find((tr) => tr.workWeek && isValidWeek(tr.workWeek))?.workWeek ?? settings.workWeek;
    const days = resolved(week);
    const explicit = !!week;

    // Earliest start allowed by the predecessors: FS = day after the predecessor ends, SS = the day it starts, plus lag.
    // Day-based tasks use whole days; hour-based tasks use the clock (they may start right after a predecessor ends).
    let depStart: number | null = null;
    let driving: Task[] = [];
    let depT: number | null = null;
    let drivingT: Task[] = [];
    for (const { pred, type, lag } of linksOf.get(task)!) {
      if (!endDay.has(pred)) continue;
      const limit = type === "SS" ? startDayOf.get(pred)! + lag : endDay.get(pred)! + 1 + lag;
      if (depStart === null || limit > depStart) {
        depStart = limit;
        driving = [pred];
      } else if (limit === depStart) {
        driving.push(pred);
      }
      const limT = (type === "SS" ? startT.get(pred)! : endT.get(pred)!) + lag * MINUTES_PER_DAY;
      if (depT === null || limT > depT + EPS) {
        depT = limT;
        drivingT = [pred];
      } else if (Math.abs(limT - depT) <= EPS) {
        drivingT.push(pred);
      }
    }
    drivers.set(task, hourMode ? drivingT : driving);

    const manStart = task.manualStart ? dayNumber(task.manualStart) : null;

    const weatherSensitive = !task.weatherIndependent;
    const canWork = (day: number) =>
      cal.isWorkingDay(day, task.allowWeekend, task.allowHoliday) &&
      (!weatherSensitive || !cal.isWeatherDay(day)) &&
      days[weekdayOf(day)] !== null;

    let start: number;
    let end: number;
    let startMin = 0;
    let endMin = 0;
    // Hours worked on each day of the task (used for the cost)
    const dayList: { day: number; hours: number }[] = [];

    if (hourMode) {
      const manT = manStart !== null ? manStart * MINUTES_PER_DAY + (task.startTime ?? 0) : null;
      let at = (effectiveStartDay ?? 0) * MINUTES_PER_DAY;
      if (depT !== null && manT !== null) at = Math.max(depT, manT);
      else if (manT !== null) at = manT;
      else if (depT !== null) at = depT;

      let remaining = (task.durationHours as number) * 60;
      let day = Math.floor(at / MINUTES_PER_DAY);
      let m = at - day * MINUTES_PER_DAY;
      let first = true;
      let sT = at;
      let eT = at;
      for (let guard = 0; remaining > EPS && guard < 100_000; guard++) {
        if (!canWork(day)) {
          day++;
          m = 0;
          continue;
        }
        let used = 0;
        for (const [a, b] of days[weekdayOf(day)]!.windows) {
          if (m >= b) continue;
          const from = Math.max(a, m);
          const take = Math.min(b - from, remaining);
          if (take <= 0) continue;
          if (first) {
            sT = day * MINUTES_PER_DAY + from;
            first = false;
          }
          used += take;
          remaining -= take;
          eT = day * MINUTES_PER_DAY + from + take;
          m = from + take;
          if (remaining <= EPS) break;
        }
        if (used > 0) dayList.push({ day, hours: used / 60 });
        day++;
        m = 0;
      }
      start = Math.floor(sT / MINUTES_PER_DAY);
      end = Math.floor((eT - EPS) / MINUTES_PER_DAY);
      startMin = sT - start * MINUTES_PER_DAY;
      endMin = eT - end * MINUTES_PER_DAY;
      startT.set(task, sT);
      endT.set(task, eT);
    } else {
      start = effectiveStartDay ?? 0;
      if (depStart !== null && manStart !== null) start = Math.max(depStart, manStart);
      else if (manStart !== null) start = manStart;
      else if (depStart !== null) start = depStart;

      while (!canWork(start)) start++;

      end = start;
      const dayHours = (d: number) => (explicit ? days[weekdayOf(d)]!.minutes / 60 : hours);
      if (!task.isMilestone) {
        dayList.push({ day: start, hours: dayHours(start) });
        let allocated = 1;
        while (allocated < task.duration) {
          end++;
          if (canWork(end)) {
            allocated++;
            dayList.push({ day: end, hours: dayHours(end) });
          }
        }
      }
      startMin = days[weekdayOf(start)]!.windows[0]?.[0] ?? DEFAULT_START;
      const lastWindows = days[weekdayOf(end)]!.windows;
      endMin = lastWindows[lastWindows.length - 1]?.[1] ?? DEFAULT_START;
      startT.set(task, start * MINUTES_PER_DAY + startMin);
      endT.set(task, end * MINUTES_PER_DAY + endMin);
    }

    let taskCost = 0;
    const tradeCosts: { [tid: string]: number } = {};
    const assignmentCosts: { [aid: string]: number } = {};
    const roleCosts: { [rid: string]: number } = {};
    const roleHours: { [rid: string]: number } = {};

    if (!task.isMilestone) {
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

      const totalHours = dayList.reduce((sum, d) => sum + d.hours, 0);
      // Hours a trade or role is paid for on a day: its own hours on day-based tasks, the task's clock hours on hour-based tasks
      const paidHours = (week2: WeekSchedule | undefined, day: number, taskH: number): number =>
        hourMode || !week2 ? taskH : (resolved(week2)[weekdayOf(day)]?.minutes ?? 0) / 60;

      const addDay = (day: number, taskH: number) => {
        for (const tr of activeTrades) {
          if (tr.isFixedPrice) continue;
          const sup = supplement(day, tr);
          const trH = paidHours(tr.workWeek, day, taskH);
          const crews = crewOf.get(tr.id);
          if (!crews) {
            tradeCosts[tr.id] = (tradeCosts[tr.id] || 0) + trH * tr.rate * sup;
            continue;
          }
          const roleById = new Map((tr.roles || []).map((r) => [r.id, r]));
          for (const a of crews) {
            const share = (a.percent ?? 100) / 100;
            for (const c of a.crew) {
              const role = roleById.get(c.roleId);
              if (!role || !(c.count > 0)) continue;
              const base = a.hours !== undefined && a.hours !== null ? (totalHours > 0 ? (a.hours * taskH) / totalHours : 0) : paidHours(role.workWeek ?? tr.workWeek, day, taskH) * share;
              const h = base * c.count;
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
      for (const d of dayList) addDay(d.day, d.hours);

      for (const tr of activeTrades) if (tr.isFixedPrice) tradeCosts[tr.id] = tr.rate;
      for (const tid in tradeCosts) taskCost += tradeCosts[tid];
    }

    startDayOf.set(task, start);
    endDay.set(task, end);
    task.calcStart = dayToStr(start);
    task.calcEnd = dayToStr(end);
    task.calcStartMin = startMin;
    task.calcEndMin = endMin;
    task.calcHours = dayList.reduce((sum, d) => sum + d.hours, 0);
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
    let maxEndT = -Infinity;
    for (const t of nonRecurringTasks) if (t.calcEnd === maxEndDate) maxEndT = Math.max(maxEndT, endT.get(t) ?? -Infinity);
    const queue = nonRecurringTasks.filter((t) => t.calcEnd === maxEndDate && Math.abs((endT.get(t) ?? 0) - maxEndT) <= EPS);
    while (queue.length > 0) {
      const current = queue.pop()!;
      current.isCritical = true;
      for (const pred of drivers.get(current) || []) if (!pred.isCritical) queue.push(pred);
    }
  }

  return { tasks, projectEndDate, projectTotalCost, scheduleError: null, startDateWarning };
}
