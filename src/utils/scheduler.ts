import { Task, Trade, Settings, Stage, WeatherDelay, Holiday } from "../types";

// Helper to construct dates at 12:00 to avoid daylight savings drift
export function createSafeDate(dateStr: string): Date {
  return new Date(`${dateStr}T12:00:00`);
}

export function toDateStr(dateObj: Date): string {
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, "0");
  const d = String(dateObj.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function isWorkingDay(dateObj: Date, allowWeekend: boolean, allowHoliday: boolean, holidays: string[]): boolean {
  const dateStr = toDateStr(dateObj);
  const dayOfWeek = dateObj.getDay(); // 0 = Sunday, 6 = Saturday
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
  const isHoliday = holidays.includes(dateStr);

  if (isHoliday && !allowHoliday) return false;
  if (isWeekend && !allowWeekend) return false;

  return true;
}

export function isWeatherDelayDay(dateObj: Date, weatherDelays: WeatherDelay[] = []): boolean {
  const dateStr = toDateStr(dateObj);
  return weatherDelays.some(delay => dateStr >= delay.startDate && dateStr <= delay.endDate);
}

export function detectCycle(tasks: Task[]): boolean {
  const adjMap = new Map<string, string | null>();
  tasks.forEach((t) => adjMap.set(t.id, t.dependencyId));

  const visited = new Set<string>();
  const recStack = new Set<string>();

  function isCyclic(taskId: string | null): boolean {
    if (!taskId) return false;
    if (recStack.has(taskId)) return true;
    if (visited.has(taskId)) return false;

    visited.add(taskId);
    recStack.add(taskId);

    const parentId = adjMap.get(taskId) || null;
    if (parentId && isCyclic(parentId)) return true;

    recStack.delete(taskId);
    return false;
  }

  for (const task of tasks) {
    if (isCyclic(task.id)) return true;
  }
  return false;
}

export function calculateSchedule(
  tasksInput: Task[],
  trades: Trade[],
  holidays: Holiday[],
  settings: Settings,
  projectStartDate: string,
  stagesInput: Stage[] = [],
  weatherDelays: WeatherDelay[] = []
): {
  tasks: Task[];
  projectEndDate: string | null;
  projectTotalCost: number;
  scheduleError: string | null;
  startDateWarning: string | null;
} {
  let scheduleError: string | null = null;
  let startDateWarning: string | null = null;

  // Convert named Holiday array to simple string date array for back-compatibility
  const holidayDates = (holidays || []).map((h) => typeof h === "string" ? h : (h as any).date);

  // Clear previous metrics
  const tasks = tasksInput.map((t) => ({
    ...t,
    calcStart: null,
    calcEnd: null,
    calcCost: 0,
    isCritical: false,
    tradeCosts: {} as { [tradeId: string]: number },
    occurrences: [] as string[],
  }));

  if (tasks.length === 0) {
    return {
      tasks,
      projectEndDate: null,
      projectTotalCost: 0,
      scheduleError,
      startDateWarning,
    };
  }

  // Detect circular dependency loops
  if (detectCycle(tasks)) {
    return {
      tasks,
      projectEndDate: null,
      projectTotalCost: 0,
      scheduleError: "Rundgang / Cyklus opdaget: Nogle opgaver afhænger af hinanden i en lukket cirkel. Fjern afhængighederne for at beregne.",
      startDateWarning,
    };
  }

  // Find the earliest start date specified among tasks or fallback to global settings
  const manualStarts = tasks
    .filter((t) => !t.isRecurring)
    .map((t) => t.manualStart)
    .filter((ms): ms is string => !!ms)
    .sort();
  const earliestTaskStart = manualStarts.length > 0 ? manualStarts[0] : null;

  let effectiveStartDate = projectStartDate;

  if (effectiveStartDate) {
    if (earliestTaskStart && earliestTaskStart < effectiveStartDate) {
      startDateWarning = `Bemærk: Mindst én opgave har en startdato (${earliestTaskStart}), der ligger før projektets startdato (${effectiveStartDate}).`;
    }
  } else if (earliestTaskStart) {
    effectiveStartDate = earliestTaskStart;
  } else {
    // No start date found anywhere => return uncalculated tasks
    return {
      tasks,
      projectEndDate: null,
      projectTotalCost: 0,
      scheduleError: "Projektets startdato er ikke angivet. Gå til Indstillinger eller giv en opgave en startdato.",
      startDateWarning,
    };
  }

  // Filter tasks: non-recurring scheduled with normal dependencies
  const nonRecurringTasks = tasks.filter((t) => !t.isRecurring);

  // Iterative push-right algorithm
  let iterations = 0;
  const maxIterations = Math.max(1, nonRecurringTasks.length * 2);
  let changed = true;

  while (changed && iterations < maxIterations) {
    changed = false;

    for (const task of nonRecurringTasks) {
      let expectedStart = createSafeDate(effectiveStartDate);
      let depStart: Date | null = null;
      let manStart: Date | null = null;

      if (task.dependencyId) {
        const depTask = nonRecurringTasks.find((t) => t.id === task.dependencyId);
        if (depTask && depTask.calcEnd) {
          depStart = createSafeDate(depTask.calcEnd);
          depStart.setDate(depStart.getDate() + 1); // Starts the next solar day
        }
      }

      if (task.manualStart) {
        manStart = createSafeDate(task.manualStart);
      }

      // Schedulers priority logic
      if (depStart && manStart) {
        expectedStart = new Date(Math.max(depStart.getTime(), manStart.getTime()));
      } else if (manStart) {
        expectedStart = manStart;
      } else if (depStart) {
        expectedStart = depStart;
      }

      // Skip non-working days & weather delays for start date
      while (
        !isWorkingDay(expectedStart, task.allowWeekend, task.allowHoliday, holidayDates) ||
        (!task.weatherIndependent && isWeatherDelayDay(expectedStart, weatherDelays))
      ) {
        expectedStart.setDate(expectedStart.getDate() + 1);
      }

      let expectedEnd = createSafeDate(toDateStr(expectedStart));
      let taskCost = 0;
      const tradeCostsTracker: { [tid: string]: number } = {};

      const activeTrades = (task.tradeIds || [])
        .map((tid) => trades.find((tr) => tr.id === tid))
        .filter((tr): tr is Trade => !!tr);

      const getDayCost = (dObj: Date, tr: Trade): number => {
        if (tr.isFixedPrice) return 0; // Handled separately
        let cost = settings.workHoursPerDay * tr.rate;
        const dayOfWeek = dObj.getDay();
        const isWe = dayOfWeek === 0 || dayOfWeek === 6;
        const isHol = holidayDates.includes(toDateStr(dObj));

        if (isHol) {
          cost += cost * (tr.holidaySupplement / 100);
        } else if (isWe) {
          cost += cost * (tr.weekendSupplement / 100);
        }
        return cost;
      };

      if (task.isMilestone) {
        // Milestones take 0 active working days and incur 0 cost
        expectedEnd = createSafeDate(toDateStr(expectedStart));
        taskCost = 0;
      } else {
        // Set baseline day costs for first day
        activeTrades.forEach((tr) => {
          tradeCostsTracker[tr.id] = tr.isFixedPrice ? tr.rate : getDayCost(expectedStart, tr);
        });

        // Advance dates to satisfy the duration (duration is in days)
        let daysAllocated = 1;
        while (daysAllocated < task.duration) {
          expectedEnd.setDate(expectedEnd.getDate() + 1);

          if (
            isWorkingDay(expectedEnd, task.allowWeekend, task.allowHoliday, holidayDates) &&
            (task.weatherIndependent || !isWeatherDelayDay(expectedEnd, weatherDelays))
          ) {
            daysAllocated++;
            activeTrades.forEach((tr) => {
              if (!tr.isFixedPrice) {
                tradeCostsTracker[tr.id] = (tradeCostsTracker[tr.id] || 0) + getDayCost(expectedEnd, tr);
              }
            });
          }
        }

        // Add fixed-price trades as well
        activeTrades.forEach((tr) => {
          if (tr.isFixedPrice) {
            tradeCostsTracker[tr.id] = tr.rate; // Flat fixed rate
          }
        });

        for (const tid in tradeCostsTracker) {
          taskCost += tradeCostsTracker[tid];
        }
      }

      const startStr = toDateStr(expectedStart);
      const endStr = toDateStr(expectedEnd);

      if (
        task.calcStart !== startStr ||
        task.calcEnd !== endStr ||
        task.calcCost !== taskCost ||
        JSON.stringify(task.tradeCosts) !== JSON.stringify(tradeCostsTracker)
      ) {
        task.calcStart = startStr;
        task.calcEnd = endStr;
        task.calcCost = taskCost;
        task.tradeCosts = tradeCostsTracker;
        changed = true;
      }
    }
    iterations++;
  }

  // Calculate project end date from non-recurring tasks
  let maxEndDate: string | null = null;
  nonRecurringTasks.forEach((t) => {
    if (t.calcEnd && (!maxEndDate || t.calcEnd > maxEndDate)) {
      maxEndDate = t.calcEnd;
    }
  });

  const projectEndDate = maxEndDate || effectiveStartDate;

  // Now calculate recurring tasks based on the project end date & chosen stages
  const recurringTasks = tasks.filter((t) => t.isRecurring);
  recurringTasks.forEach((task) => {
    let rangeStart = task.manualStart || effectiveStartDate;
    let rangeEnd = projectEndDate;

    if (task.recurringRangeType === "stages" && task.recurringStageIds && task.recurringStageIds.length > 0) {
      const selectedStages = (stagesInput || []).filter((s) => task.recurringStageIds?.includes(s.id));
      if (selectedStages.length > 0) {
        // Range start is the minimum of stage start dates
        const starts = selectedStages.map((s) => s.startDate).sort();
        const ends = selectedStages.map((s) => s.endDate).sort();
        rangeStart = starts[0];
        rangeEnd = ends[ends.length - 1];
      }
    }

    // Generate repeat occurrences at fixed intervals (recurringInterval)
    const occurrences: string[] = [];
    const intervalDays = task.recurringInterval || 7;
    
    let curr = createSafeDate(rangeStart);
    const stopDateVal = createSafeDate(rangeEnd).getTime();

    // Prevent infinite loop if interval <= 0
    const safeInterval = intervalDays > 0 ? intervalDays : 7;

    while (curr.getTime() <= stopDateVal) {
      const actual = new Date(curr);
      
      // Shift to next available work day if weekend/holiday is not permitted or weather delay is active
      while (
        !isWorkingDay(actual, task.allowWeekend, task.allowHoliday, holidayDates) ||
        (!task.weatherIndependent && isWeatherDelayDay(actual, weatherDelays))
      ) {
        actual.setDate(actual.getDate() + 1);
      }

      if (actual.getTime() <= stopDateVal) {
        occurrences.push(toDateStr(actual));
      }
      
      // Advance by original interval
      curr.setDate(curr.getDate() + safeInterval);
    }

    task.occurrences = occurrences;
    task.calcStart = occurrences[0] || null;
    task.calcEnd = occurrences[occurrences.length - 1] || null;
    task.calcCost = occurrences.length * (task.recurringPrice || 0);
    task.tradeCosts = {};
  });

  const projectTotalCost = tasks.reduce((sum, t) => sum + (t.calcCost || 0), 0);

  // Trace the Critical Path for non-recurring tasks if maxEndDate exists
  if (maxEndDate) {
    const criticalTasksQueue = nonRecurringTasks.filter((t) => t.calcEnd === maxEndDate);
    while (criticalTasksQueue.length > 0) {
      const currentTask = criticalTasksQueue.pop();
      if (currentTask) {
        currentTask.isCritical = true;
        if (currentTask.dependencyId) {
          const dep = nonRecurringTasks.find((x) => x.id === currentTask.dependencyId);
          if (dep && !dep.isCritical) {
            criticalTasksQueue.push(dep);
          }
        }
      }
    }
  }

  return {
    tasks,
    projectEndDate,
    projectTotalCost,
    scheduleError,
    startDateWarning,
  };
}

