import type { AppData, Holiday, Task } from "../types.ts";
import { dayNumber } from "../utils/scheduler.ts";
import { nextMonday } from "../utils/dates.ts";
import { stripCalculated } from "../utils/tasks.ts";
import { taskLinks, withLinks } from "../utils/links.ts";
import { normalizeBaseline } from "../utils/baseline.ts";

export const STORAGE_KEY = "msProjectMobileData";
export const WIZARD_KEY = "msProjectWizardCompleted";
export const BACKUP_KEY = "msProjectLastBackup";

export function blankProject(): AppData {
  return {
    startDate: nextMonday(),
    settings: { workHoursPerDay: 7.4 },
    projectInfo: { projectName: "Nyt Projekt", address: "", customer: "", manager: "" },
    holidays: [],
    trades: [],
    tasks: [],
    stages: [],
    weatherDelays: [],
    baseline: null,
    scheduleError: null,
    startDateWarning: null,
  };
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const asArray = <T = unknown>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

/**
 * Turns anything that looks like a saved project (current or older format, from storage or a file)
 * into a well-formed AppData. Never throws.
 */
export function normalizeProject(raw: unknown): AppData {
  const base = blankProject();
  if (!isRecord(raw)) return base;

  // Older versions stored holidays as plain date strings
  const holidays: Holiday[] = asArray(raw.holidays)
    .map((h, idx) => {
      const item = (typeof h === "string" ? { date: h } : h) as Partial<Holiday> | null;
      return {
        id: item?.id || `hol-norm-${idx}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        date: item?.date || "",
        name: item?.name || "Lukkedag / Ferie",
      };
    })
    .filter((h) => h.date);

  const tasks: Task[] = asArray<Task>(raw.tasks)
    .filter(isRecord)
    .map((t, idx) => {
      const base: Task = {
      ...stripCalculated(t as unknown as Task),
      id: typeof t.id === "string" && t.id ? t.id : `task-imp-${idx}`,
      title: typeof t.title === "string" ? t.title : "Opgave",
      desc: typeof t.desc === "string" ? t.desc : "",
      tradeIds: asArray<string>(t.tradeIds),
      allowWeekend: !!t.allowWeekend,
      allowHoliday: !!t.allowHoliday,
      };
      // Sanitise predecessor links and keep dependencyId in sync (files from older versions only have dependencyId)
      return Array.isArray(base.dependencies) ? withLinks(base, taskLinks(base)) : base;
    });

  const hours = isRecord(raw.settings) ? Number(raw.settings.workHoursPerDay) : NaN;
  const startDate = typeof raw.startDate === "string" && dayNumber(raw.startDate) !== null ? raw.startDate : base.startDate;

  return {
    ...base,
    startDate,
    settings: { workHoursPerDay: hours > 0 ? hours : base.settings.workHoursPerDay },
    projectInfo: { ...base.projectInfo!, ...(isRecord(raw.projectInfo) ? raw.projectInfo : {}) },
    holidays,
    trades: asArray(raw.trades),
    tasks,
    stages: asArray(raw.stages),
    weatherDelays: asArray(raw.weatherDelays),
    baseline: normalizeBaseline(raw.baseline),
  } as AppData;
}

export function loadProject(): AppData {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return blankProject();
    return normalizeProject(JSON.parse(saved));
  } catch {
    return blankProject();
  }
}

/** Returns false when the browser refused (storage full, private mode, ...). */
export function saveProject(state: AppData): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

export function readNumber(key: string): number | null {
  try {
    const v = Number(localStorage.getItem(key));
    return Number.isFinite(v) && v > 0 ? v : null;
  } catch {
    return null;
  }
}

export function writeFlag(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* storage unavailable */
  }
}

/** True when the file/object has the minimum a project needs. */
export function looksLikeProject(raw: unknown): boolean {
  return isRecord(raw) && Array.isArray(raw.tasks) && Array.isArray(raw.trades);
}
