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
  
  // Recurring tasks properties
  isRecurring?: boolean;
  recurringInterval?: number; // every X days
  recurringPrice?: number; // price per recurrence
  recurringRangeType?: "project" | "stages"; 
  recurringStageIds?: string[]; // which stages it repeats during

  // Calculated properties
  calcStart?: string | null;
  calcEnd?: string | null;
  calcCost?: number;
  isCritical?: boolean;
  tradeCosts?: { [tradeId: string]: number };
  occurrences?: string[]; // List of YYYY-MM-DD dates where recurring task takes place
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
  holidays: string[]; // "YYYY-MM-DD"
  trades: Trade[];
  tasks: Task[];
  stages?: Stage[]; // List of stages
  scheduleError: string | null;
  startDateWarning: string | null;
}

