import type { Stage, Task, Trade } from "../types.ts";
import { dayNumber } from "./scheduler.ts";
import { descendantsOf, taskLinks } from "./links.ts";

export type WarningKind = "after-stage-end" | "before-stage-start" | "no-trade" | "double-booking" | "role-overload" | "unscheduled";

/** A change that resolves a warning with one click. */
export type WarningFix =
  | { type: "extend-stage-end"; stageId: string; date: string; label: string }
  | { type: "move-stage-start"; stageId: string; date: string; label: string }
  | { type: "after"; taskId: string; afterId: string; label: string };

export interface PlanWarning {
  id: string;
  kind: WarningKind;
  /** The task(s) involved; the first one is opened when the warning is clicked. */
  taskIds: string[];
  message: string;
  fix?: WarningFix;
}

/** Position on the clock (minutes). Tasks without clock info count as whole days. */
const startOf = (t: Task): number => (dayNumber(t.calcStart) ?? 0) * 1440 + (t.calcStartMin ?? 0);
const endOf = (t: Task): number => (dayNumber(t.calcEnd) ?? 0) * 1440 + (t.calcEndMin ?? 1440);
const hm = (min: number): string => `${Math.floor((min % 1440) / 60)}:${String(Math.round(min % 60)).padStart(2, "0")}`;

const fmt = (iso: string): string => {
  const [y, m, d] = iso.split("-");
  return y && m && d ? `${Number(d)}/${Number(m)}` : iso;
};

/** Sanity checks on a calculated plan. All checks are advisory: the plan is still valid. */
export function findWarnings(tasks: Task[], trades: Trade[], stages: Stage[]): PlanWarning[] {
  const out: PlanWarning[] = [];
  const stageById = new Map(stages.map((s) => [s.id, s]));
  const tradeName = new Map(trades.map((t) => [t.id, t.name]));

  for (const t of tasks) {
    if (t.isRecurring) continue;

    if (!t.calcStart || !t.calcEnd) {
      out.push({ id: `unscheduled:${t.id}`, kind: "unscheduled", taskIds: [t.id], message: `"${t.title}" kunne ikke placeres i tidsplanen.` });
      continue;
    }

    const stage = t.stageId ? stageById.get(t.stageId) : undefined;
    if (stage) {
      if (t.calcEnd > stage.endDate) {
        out.push({
          id: `after:${t.id}`,
          kind: "after-stage-end",
          taskIds: [t.id],
          message: `"${t.title}" slutter ${fmt(t.calcEnd)} - efter etapen "${stage.name}" er slut (${fmt(stage.endDate)}).`,
          fix: { type: "extend-stage-end", stageId: stage.id, date: t.calcEnd, label: `Forlæng etapen til ${fmt(t.calcEnd)}` },
        });
      }
      if (t.calcStart < stage.startDate) {
        out.push({
          id: `before:${t.id}`,
          kind: "before-stage-start",
          taskIds: [t.id],
          message: `"${t.title}" starter ${fmt(t.calcStart)} - før etapen "${stage.name}" begynder (${fmt(stage.startDate)}).`,
          fix: { type: "move-stage-start", stageId: stage.id, date: t.calcStart, label: `Flyt etapens start til ${fmt(t.calcStart)}` },
        });
      }
    }

    if (!t.isMilestone && (t.tradeIds || []).length === 0) {
      out.push({ id: `notrade:${t.id}`, kind: "no-trade", taskIds: [t.id], message: `"${t.title}" har ingen faggruppe tilknyttet.` });
    }
  }

  // Possible double booking: the same trade on two tasks that overlap in time (sweep per trade)
  const byTrade = new Map<string, Task[]>();
  const hasRoles = new Set(trades.filter((tr) => (tr.roles || []).length > 0).map((tr) => tr.id));
  for (const t of tasks) {
    if (t.isRecurring || t.isMilestone || !t.calcStart || !t.calcEnd) continue;
    for (const id of new Set(t.tradeIds || [])) {
      if (hasRoles.has(id) && (t.assignments || []).some((a) => a.tradeId === id)) continue; // staffed tasks are checked per role below
      const list = byTrade.get(id);
      if (list) list.push(t);
      else byTrade.set(id, [t]);
    }
  }
  for (const [tradeId, list] of byTrade) {
    list.sort((x, y) => startOf(x) - startOf(y));
    let holder: Task | null = null; // the task with the latest end so far
    for (const t of list) {
      if (holder && startOf(t) < endOf(holder)) {
        const from = t.calcStart!;
        const to = t.calcEnd! < holder.calcEnd! ? t.calcEnd! : holder.calcEnd!;
        const clockInfo = t.durationHours || holder.durationHours ? ` (kl. ${hm(startOf(t))}-${hm(Math.min(endOf(t), endOf(holder)))})` : "";
        out.push({
          id: `double:${tradeId}:${holder.id}:${t.id}`,
          kind: "double-booking",
          taskIds: [t.id, holder.id],
          message: `${tradeName.get(tradeId) ?? "Faggruppen"} er på både "${holder.title}" og "${t.title}" ${fmt(from)}-${fmt(to)}${clockInfo}.`,
          // Put the later task after the other one, unless that would make a loop
          fix: descendantsOf(tasks, t.id).has(holder.id) || holder.id === t.id
            ? undefined
            : { type: "after", taskId: t.id, afterId: holder.id, label: `Sæt "${t.title}" efter "${holder.title}"` },
        });
      }
      if (!holder || endOf(t) > endOf(holder)) holder = t;
    }
  }

  // Role overload: more people of one role needed at the same time than the trade has
  for (const tr of trades) {
    for (const role of tr.roles || []) {
      const events: { at: number; delta: number; task: Task }[] = [];
      for (const t of tasks) {
        if (t.isRecurring || t.isMilestone || !t.calcStart || !t.calcEnd) continue;
        let need = 0;
        for (const a of t.assignments || []) if (a.tradeId === tr.id) for (const c of a.crew) if (c.roleId === role.id) need += c.count;
        if (need <= 0) continue;
        events.push({ at: startOf(t), delta: need, task: t });
        events.push({ at: endOf(t), delta: -need, task: t });
      }
      events.sort((a, b) => a.at - b.at || a.delta - b.delta);
      let load = 0;
      const active = new Map<string, Task>();
      let over: { from: number; peak: number; ids: Set<string> } | null = null;
      for (let i = 0; i < events.length; i++) {
        const e = events[i];
        load += e.delta;
        if (e.delta > 0) active.set(e.task.id, e.task);
        else active.delete(e.task.id);
        if (events[i + 1]?.at === e.at) continue; // apply all events at one moment first
        if (load > role.count) {
          if (!over) over = { from: e.at, peak: load, ids: new Set() };
          over.peak = Math.max(over.peak, load);
          for (const id of active.keys()) over.ids.add(id);
        } else if (over) {
          const ids = [...over.ids];
          const fromDay = Math.floor(over.from / 1440);
          out.push({
            id: `overload:${role.id}:${Math.round(over.from)}`,
            kind: "role-overload",
            taskIds: ids,
            message: `${tr.name}: ${over.peak} ${role.name.toLowerCase()} skal arbejde samtidig fra ${fmtDay(fromDay)}, men der er kun ${role.count} (${ids.length} opgaver).`,
          });
          over = null;
        }
      }
    }
  }

  return out;
}

function fmtDay(day: number): string {
  const d = new Date(day * 86_400_000);
  return `${d.getUTCDate()}/${d.getUTCMonth() + 1}`;
}

/** Applies a fix to the project data (uncalculated tasks and stages). Returns new arrays. */
export function applyFix<T extends Task>(fix: WarningFix, tasks: T[], stages: Stage[]): { tasks: T[]; stages: Stage[] } {
  switch (fix.type) {
    case "extend-stage-end":
      return { tasks, stages: stages.map((s) => (s.id === fix.stageId && fix.date > s.endDate ? { ...s, endDate: fix.date } : s)) };
    case "move-stage-start":
      return { tasks, stages: stages.map((s) => (s.id === fix.stageId && fix.date < s.startDate ? { ...s, startDate: fix.date } : s)) };
    case "after":
      return {
        stages,
        tasks: tasks.map((t) => {
          if (t.id !== fix.taskId) return t;
          const links = taskLinks(t);
          const next = links.some((l) => l.taskId === fix.afterId)
            ? links.map((l) => (l.taskId === fix.afterId ? { ...l, type: "FS" as const, lag: Math.max(0, l.lag) } : l))
            : [...links, { taskId: fix.afterId, type: "FS" as const, lag: 0 }];
          return { ...t, dependencies: next, dependencyId: next[0].taskId };
        }),
      };
  }
}
