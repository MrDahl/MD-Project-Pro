import type { Task, Trade } from "../types.ts";

export interface TaskFilter {
  query: string;
  /** "" = all, "none" = tasks without a stage, otherwise a stage id. */
  stageId: string;
  /** "" = all, otherwise a trade id. */
  tradeId: string;
  criticalOnly: boolean;
}

export const EMPTY_FILTER: TaskFilter = { query: "", stageId: "", tradeId: "", criticalOnly: false };

export const isFilterActive = (f: TaskFilter): boolean => f.query.trim() !== "" || f.stageId !== "" || f.tradeId !== "" || f.criticalOnly;

/** Tasks matching the filter, each with its original (1-based) number in the full list. */
export function filterTasks(tasks: Task[], trades: Trade[], f: TaskFilter): { task: Task; number: number }[] {
  const q = f.query.trim().toLocaleLowerCase("da-DK");
  const tradeName = new Map(trades.map((t) => [t.id, t.name.toLocaleLowerCase("da-DK")]));
  const out: { task: Task; number: number }[] = [];

  tasks.forEach((task, i) => {
    if (f.criticalOnly && !task.isCritical) return;
    if (f.stageId === "none" ? !!task.stageId : f.stageId !== "" && task.stageId !== f.stageId) return;
    if (f.tradeId && !(task.tradeIds || []).includes(f.tradeId)) return;
    if (q) {
      const haystack = [task.title, task.desc, ...(task.tradeIds || []).map((id) => tradeName.get(id) ?? "")].join("\n").toLocaleLowerCase("da-DK");
      if (!haystack.includes(q)) return;
    }
    out.push({ task, number: i + 1 });
  });
  return out;
}

/** Fresh copy of a task for "duplicate": new id, "(kopi)" in the title, progress reset. */
export function duplicateTask(task: Task, newId: string): Task {
  const { calcStart, calcEnd, calcCost, isCritical, tradeCosts, occurrences, ...rest } = task;
  void calcStart; void calcEnd; void calcCost; void isCritical; void tradeCosts; void occurrences;
  return { ...rest, id: newId, title: `${task.title} (kopi)`, progress: 0, tradeIds: [...(task.tradeIds || [])] };
}
