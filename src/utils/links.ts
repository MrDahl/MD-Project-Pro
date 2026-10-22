import type { Dependency, Task } from "../types.ts";

type LinkSource = Pick<Task, "dependencyId" | "dependencies">;

/** The task's predecessors. Files from before multi-predecessor support only have `dependencyId` (= one FS link, no lag). */
export function taskLinks(task: LinkSource): Dependency[] {
  if (Array.isArray(task.dependencies)) {
    const seen = new Set<string>();
    const out: Dependency[] = [];
    for (const d of task.dependencies) {
      if (!d || typeof d.taskId !== "string" || !d.taskId || seen.has(d.taskId)) continue;
      seen.add(d.taskId);
      const lag = Number(d.lag);
      out.push({ taskId: d.taskId, type: d.type === "SS" ? "SS" : "FS", lag: Number.isFinite(lag) ? Math.trunc(lag) : 0 });
    }
    return out;
  }
  return task.dependencyId ? [{ taskId: task.dependencyId, type: "FS", lag: 0 }] : [];
}

/** Returns the task with the given predecessors, keeping `dependencyId` (first link) in sync. */
export function withLinks<T extends Task>(task: T, links: Dependency[]): T {
  return { ...task, dependencies: links, dependencyId: links.length > 0 ? links[0].taskId : null };
}

/** Removes every link that points at `taskId`. Returns the same object when nothing changed. */
export function removeLinksTo<T extends Task>(task: T, taskId: string): T {
  const links = taskLinks(task);
  const kept = links.filter((l) => l.taskId !== taskId);
  return kept.length === links.length ? task : withLinks(task, kept);
}

export const hasLinkTo = (task: LinkSource, taskId: string): boolean => taskLinks(task).some((l) => l.taskId === taskId);

/** Ids of all tasks that (directly or indirectly) depend on `taskId`. */
export function descendantsOf(tasks: Task[], taskId: string): Set<string> {
  const children = new Map<string, string[]>();
  for (const t of tasks) for (const l of taskLinks(t)) {
    const list = children.get(l.taskId);
    if (list) list.push(t.id);
    else children.set(l.taskId, [t.id]);
  }
  const result = new Set<string>();
  const stack = [taskId];
  while (stack.length > 0) {
    for (const c of children.get(stack.pop()!) || []) {
      if (!result.has(c)) {
        result.add(c);
        stack.push(c);
      }
    }
  }
  return result;
}
