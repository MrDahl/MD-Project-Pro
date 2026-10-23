/** One working day: from `start` to `end` (minutes after midnight), with unpaid breaks in between. */
export interface DaySchedule {
  start: number;
  end: number;
  breaks: { from: number; to: number }[];
}

/** Seven entries, index 0 = Sunday ... 6 = Saturday. null = no work that day. */
export type WeekSchedule = (DaySchedule | null)[];

/** A sub-resource of a trade (entreprise), e.g. "Svend" x 2 at 450 kr/t. */
export interface Role {
  id: string;
  name: string;
  count: number; // how many people the trade has in this role
  rate: number; // kr/t per person
  /** Own working hours (used for pay of this role on day-based tasks) */
  workWeek?: WeekSchedule;
}

/** An activity inside a task with its own crew, e.g. "Kabeltræk" = 2 apprentices. */
export interface Assignment {
  id: string;
  tradeId: string;
  label: string;
  crew: { roleId: string; count: number }[];
  /** Share of the task's working hours the crew is busy (default 100) */
  percent?: number;
  /** Hours per person for the whole task. When set it is used instead of `percent`. */
  hours?: number;
}

export interface Trade {
  id: string;
  name: string;
  rate: number;
  isFixedPrice: boolean;
  weekendSupplement: number;
  holidaySupplement: number;
  color: string;
  /** Optional sub-resources. Without them the trade is paid by `rate` alone. */
  roles?: Role[];
  /** Own working hours; otherwise the project's are used. */
  workWeek?: WeekSchedule;
}

export interface Stage {
  id: string;
  name: string;
  color: string;
  startDate: string; // "YYYY-MM-DD"
  endDate: string; // "YYYY-MM-DD"
}

export interface WeatherDelay {
  id: string;
  label: string; // e.g., "Skybrud", "Frostperiode"
  startDate: string; // "YYYY-MM-DD"
  endDate: string; // "YYYY-MM-DD"
}

/** A link to a predecessor: Finish-to-Start (FS) or Start-to-Start (SS), with a lag (or lead, if negative) in calendar days. */
export interface Dependency {
  taskId: string;
  type: "FS" | "SS";
  lag: number;
}

export interface Task {
  id: string;
  title: string;
  desc: string;
  duration: number; // working days
  /** Effort in working hours. When set the task is placed by the clock and `duration` is only an estimate in days. */
  durationHours?: number;
  /** Earliest start time on the manual start date (minutes after midnight), for hour-based tasks. */
  startTime?: number;
  manualStart: string | null; // "YYYY-MM-DD" style or null
  tradeIds: string[]; // multi-resource support
  /** Optional crews per activity. For a trade with assignments the cost comes from these instead of the trade rate. */
  assignments?: Assignment[];
  /** Primary predecessor (Finish-to-Start). Kept in sync with `dependencies` for older files and versions. */
  dependencyId: string | null;
  /** All predecessors. When present it is the source of truth; see utils/links.ts. */
  dependencies?: Dependency[];
  allowWeekend: boolean;
  allowHoliday: boolean;
  
  // Stage association
  stageId?: string | null; 
  
  // Progress & Type additions
  progress?: number; // 0-100 percentage of task completion
  isMilestone?: boolean; // Milestone is a 0-day landmark
  
  // Recurring tasks properties
  isRecurring?: boolean;
  recurringInterval?: number; // every X days
  recurringPrice?: number; // price per recurrence
  recurringRangeType?: "project" | "stages"; 
  recurringStageIds?: string[]; // which stages it repeats during

  // Weather delay toggle
  weatherIndependent?: boolean;

  // Calculated properties
  calcStart?: string | null;
  calcEnd?: string | null;
  calcCost?: number;
  /** Minute of day the task starts / ends (end is exclusive) on calcStart / calcEnd */
  calcStartMin?: number;
  calcEndMin?: number;
  calcHours?: number;
  isCritical?: boolean;
  tradeCosts?: { [tradeId: string]: number };
  assignmentCosts?: { [assignmentId: string]: number };
  roleCosts?: { [roleId: string]: number };
  roleHours?: { [roleId: string]: number }; // person-hours
  occurrences?: string[]; // List of YYYY-MM-DD dates where recurring task takes place
}

export interface Holiday {
  id: string;
  date: string; // "YYYY-MM-DD"
  name: string; // e.g. "Skærtorsdag", "Sommerferie"
}

export interface Settings {
  workHoursPerDay: number;
  /** Detailed working hours per weekday; workHoursPerDay is then the weekday average. */
  workWeek?: WeekSchedule;
}

export interface ProjectInfo {
  projectName: string;
  address: string;
  customer: string;
  manager: string;
}

/** A saved copy of the plan, used to show how the current plan deviates from it. */
export interface Baseline {
  savedAt: string; // ISO timestamp
  endDate: string | null;
  totalCost: number;
  tasks: { id: string; start: string; end: string; cost: number }[];
}

export interface AppData {
  startDate: string;
  settings: Settings;
  projectInfo?: ProjectInfo;
  holidays: Holiday[]; // Named holidays and vacations
  trades: Trade[];
  tasks: Task[];
  stages?: Stage[]; // List of stages
  weatherDelays?: WeatherDelay[]; // Force Majeure / weather stoppages
  baseline?: Baseline | null;
  scheduleError: string | null;
  startDateWarning: string | null;
}

