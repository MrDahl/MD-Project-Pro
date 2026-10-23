import type { Assignment, Role, Task, Trade } from "../types.ts";

let counter = 0;
/** Short unique id for roles and assignments. */
export function newId(prefix: string): string {
  counter += 1;
  return `${prefix}-${Date.now().toString(36)}${counter.toString(36)}${Math.random().toString(36).slice(2, 5)}`;
}

/** Hourly cost of a whole crew (sum of count x rate), weekday rate. */
export function crewHourly(a: Pick<Assignment, "crew">, roles: Role[] | undefined): number {
  const byId = new Map((roles || []).map((r) => [r.id, r]));
  let sum = 0;
  for (const c of a.crew) sum += (byId.get(c.roleId)?.rate ?? 0) * Math.max(0, c.count);
  return sum;
}

/** Cost of the trade's whole staff for one hour (everyone on the team). */
export function teamHourly(trade: Trade): number {
  return (trade.roles || []).reduce((s, r) => s + r.rate * r.count, 0);
}

/** Removes crew lines that point at roles that no longer exist and drops empty activities. */
export function cleanAssignments(assignments: Assignment[] | undefined, trades: Trade[]): Assignment[] | undefined {
  if (!assignments || assignments.length === 0) return undefined;
  const roleIds = new Map(trades.map((t) => [t.id, new Set((t.roles || []).map((r) => r.id))]));
  const out = assignments
    .filter((a) => roleIds.has(a.tradeId))
    .map((a) => ({ ...a, crew: a.crew.filter((c) => roleIds.get(a.tradeId)!.has(c.roleId) && c.count > 0) }))
    .filter((a) => a.crew.length > 0);
  return out.length ? out : undefined;
}

export interface ResourceReport {
  total: number;
  hours: number;
  byRole: { roleId: string; name: string; count: number; hours: number; cost: number }[];
  byActivity: { label: string; cost: number; tasks: number }[];
  /** Cost the trade has without crews (paid by the standard rate) */
  unstaffed: number;
  byTask: { id: string; title: string; cost: number }[];
}

/** Costs of one trade (entreprise), optionally limited to one stage. Expects calculated tasks. */
export function resourceReport(tasks: Task[], trade: Trade, stageId = ""): ResourceReport {
  const rep: ResourceReport = { total: 0, hours: 0, byRole: [], byActivity: [], unstaffed: 0, byTask: [] };
  const roles = new Map((trade.roles || []).map((r) => [r.id, { roleId: r.id, name: r.name, count: r.count, hours: 0, cost: 0 }]));
  const acts = new Map<string, { label: string; cost: number; tasks: number }>();
  for (const t of tasks) {
    if (stageId && (t.stageId || "") !== stageId) continue;
    const cost = t.tradeCosts?.[trade.id];
    if (!cost) continue;
    rep.total += cost;
    rep.byTask.push({ id: t.id, title: t.title, cost });
    let staffed = 0;
    for (const a of t.assignments || []) {
      if (a.tradeId !== trade.id) continue;
      const c = t.assignmentCosts?.[a.id] ?? 0;
      staffed += c;
      const label = a.label.trim() || "(uden navn)";
      const e = acts.get(label) ?? { label, cost: 0, tasks: 0 };
      e.cost += c;
      e.tasks += 1;
      acts.set(label, e);
    }
    rep.unstaffed += cost - staffed;
    for (const [rid, c] of Object.entries(t.roleCosts || {})) {
      const r = roles.get(rid);
      if (!r) continue;
      r.cost += c;
      r.hours += t.roleHours?.[rid] ?? 0;
    }
  }
  rep.byRole = [...roles.values()].filter((r) => r.cost > 0);
  rep.hours = rep.byRole.reduce((s, r) => s + r.hours, 0);
  rep.byActivity = [...acts.values()].sort((a, b) => b.cost - a.cost);
  rep.byTask.sort((a, b) => b.cost - a.cost);
  return rep;
}
