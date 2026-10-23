import type { Task } from "../types.ts";
import { removeLinksTo } from "./links.ts";

export interface BulkChange {
  /** undefined = leave alone, null = remove from stage */
  stageId?: string | null;
  addTradeId?: string;
  removeTradeId?: string;
  /** Replace all trades with this one (crews of other trades are dropped) */
  setTradeId?: string;
  duration?: number;
  /** Add (or subtract) working days to the duration, never below 1 */
  durationDelta?: number;
  allowWeekend?: boolean;
  weatherIndependent?: boolean;
}

/** Applies one change to every selected task. Milestones and recurring tasks keep their duration. */
export function applyBulk(tasks: Task[], ids: ReadonlySet<string>, change: BulkChange): Task[] {
  return tasks.map((t) => {
    if (!ids.has(t.id)) return t;
    const n: Task = { ...t };
    if (change.stageId !== undefined) n.stageId = change.stageId;
    if (change.setTradeId !== undefined) {
      n.tradeIds = [change.setTradeId];
      if (n.assignments) n.assignments = n.assignments.filter((a) => a.tradeId === change.setTradeId);
    }
    if (change.addTradeId && !(n.tradeIds || []).includes(change.addTradeId)) n.tradeIds = [...(n.tradeIds || []), change.addTradeId];
    if (change.removeTradeId) {
      n.tradeIds = (n.tradeIds || []).filter((id) => id !== change.removeTradeId);
      if (n.assignments) n.assignments = n.assignments.filter((a) => a.tradeId !== change.removeTradeId);
    }
    if (n.assignments && n.assignments.length === 0) delete n.assignments;
    const fixedDuration = n.isMilestone || n.isRecurring;
    if (!fixedDuration && change.duration !== undefined) n.duration = Math.max(1, Math.round(change.duration));
    if (!fixedDuration && change.durationDelta) n.duration = Math.max(1, n.duration + Math.round(change.durationDelta));
    if (change.allowWeekend !== undefined) n.allowWeekend = change.allowWeekend;
    if (change.weatherIndependent !== undefined) n.weatherIndependent = change.weatherIndependent;
    return n;
  });
}

/** Removes the selected tasks and unlinks anything that depended on them. */
export function deleteMany(tasks: Task[], ids: ReadonlySet<string>): Task[] {
  let out = tasks.filter((t) => !ids.has(t.id));
  for (const id of ids) out = out.map((t) => removeLinksTo(t, id));
  return out;
}
