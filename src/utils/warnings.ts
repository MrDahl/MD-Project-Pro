import type { Stage, Task, Trade } from "../types.ts";

export type WarningKind = "after-stage-end" | "before-stage-start" | "no-trade" | "double-booking" | "unscheduled";

export interface PlanWarning {
  id: string;
  kind: WarningKind;
  /** The task(s) involved; the first one is opened when the warning is clicked. */
  taskIds: string[];
  message: string;
}

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
        });
      }
      if (t.calcStart < stage.startDate) {
        out.push({
          id: `before:${t.id}`,
          kind: "before-stage-start",
          taskIds: [t.id],
          message: `"${t.title}" starter ${fmt(t.calcStart)} - før etapen "${stage.name}" begynder (${fmt(stage.startDate)}).`,
        });
      }
    }

    if (!t.isMilestone && (t.tradeIds || []).length === 0) {
      out.push({ id: `notrade:${t.id}`, kind: "no-trade", taskIds: [t.id], message: `"${t.title}" har ingen faggruppe tilknyttet.` });
    }
  }

  // Possible double booking: the same trade on two tasks that overlap in time (sweep per trade)
  const byTrade = new Map<string, Task[]>();
  for (const t of tasks) {
    if (t.isRecurring || t.isMilestone || !t.calcStart || !t.calcEnd) continue;
    for (const id of new Set(t.tradeIds || [])) {
      const list = byTrade.get(id);
      if (list) list.push(t);
      else byTrade.set(id, [t]);
    }
  }
  for (const [tradeId, list] of byTrade) {
    list.sort((a, b) => a.calcStart!.localeCompare(b.calcStart!));
    let holder: Task | null = null; // the task with the latest end so far
    for (const t of list) {
      if (holder && t.calcStart! <= holder.calcEnd!) {
        const from = t.calcStart!;
        const to = t.calcEnd! < holder.calcEnd! ? t.calcEnd! : holder.calcEnd!;
        out.push({
          id: `double:${tradeId}:${holder.id}:${t.id}`,
          kind: "double-booking",
          taskIds: [t.id, holder.id],
          message: `${tradeName.get(tradeId) ?? "Faggruppen"} er på både "${holder.title}" og "${t.title}" ${fmt(from)}-${fmt(to)}.`,
        });
      }
      if (!holder || t.calcEnd! > holder.calcEnd!) holder = t;
    }
  }

  return out;
}
