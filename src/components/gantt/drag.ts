import type { Task } from "../../types.ts";
import { dayNumber, dayToStr } from "../../utils/scheduler.ts";

/**
 * Result of dragging a bar `deltaDays` columns: the dragged task gets a new manual start,
 * and when moved to the right every (indirect) successor that has a manual start follows along.
 * Always computed from the untouched baseline, so dragging back to 0 restores the original plan.
 */
export function applyMove(baseline: Task[], taskId: string, newStartDate: string, deltaDays: number): Task[] {
  const result = baseline.slice();
  const index = new Map<string, number>();
  baseline.forEach((t, i) => {
    if (!index.has(t.id)) index.set(t.id, i);
  });

  const root = index.get(taskId);
  if (root === undefined) return baseline;
  result[root] = { ...baseline[root], manualStart: newStartDate };

  if (deltaDays > 0) {
    const children = new Map<string, number[]>();
    baseline.forEach((t, i) => {
      if (t.dependencyId) {
        const list = children.get(t.dependencyId);
        if (list) list.push(i);
        else children.set(t.dependencyId, [i]);
      }
    });

    const seen = new Set<string>([taskId]);
    const queue: string[] = [taskId];
    while (queue.length > 0) {
      const parent = queue.pop()!;
      for (const i of children.get(parent) || []) {
        const child = baseline[i];
        if (seen.has(child.id)) continue; // guards against dependency loops
        seen.add(child.id);
        const day = dayNumber(child.manualStart);
        if (day !== null) result[i] = { ...child, manualStart: dayToStr(day + deltaDays) };
        queue.push(child.id);
      }
    }
  }

  return result;
}

export function applyResize(baseline: Task[], taskId: string, newDuration: number): Task[] {
  return baseline.map((t) => (t.id === taskId ? { ...t, duration: Math.max(1, newDuration) } : t));
}
