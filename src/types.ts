export interface Trade {
  id: string;
  name: string;
  rate: number;
  isFixedPrice: boolean;
  weekendSupplement: number;
  holidaySupplement: number;
  color: string;
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

export interface Task {
  id: string;
  title: string;
  desc: string;
  duration: number; // working days
  manualStart: string | null; // "YYYY-MM-DD" style or null
  tradeIds: string[]; // multi-resource support
  dependencyId: string | null; // Finish-to-Start predecessor
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
  isCritical?: boolean;
  tradeCosts?: { [tradeId: string]: number };
  occurrences?: string[]; // List of YYYY-MM-DD dates where recurring task takes place
}

export interface Holiday {
  id: string;
  date: string; // "YYYY-MM-DD"
  name: string; // e.g. "Skærtorsdag", "Sommerferie"
}

export interface Settings {
  workHoursPerDay: number;
}

export interface ProjectInfo {
  projectName: string;
  address: string;
  customer: string;
  manager: string;
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
  scheduleError: string | null;
  startDateWarning: string | null;
}

