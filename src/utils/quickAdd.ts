import type { Dependency, Stage, Task, Trade } from "../types.ts";

export interface QuickAddParsed {
  title: string;
  /** workdays (weeks are converted: 1 uge = 5 dage) */
  days?: number;
  hours?: number;
  milestone: boolean;
  tradeNames: string[];
  stageName?: string;
  afterTitle?: string;
}

const UNIT = /(?:^|\s)(\d+(?:[.,]\d+)?)\s*(uger|uge|u|dage|dag|d|timer|time|t)(?=\s|$|[@#])/i;

/**
 * Understands short task descriptions such as
 *   "Maling 5 dage @Maler efter Gipsplader"
 *   "Rillefræsning 4 timer @Elektriker #Opstart"
 *   "Aflevering milepæl"
 * Everything after "@" is a trade, after "#" a stage and after "efter" the predecessor.
 */
export function parseQuickAdd(input: string): QuickAddParsed {
  let rest = ` ${input.trim()} `;
  const out: QuickAddParsed = { title: "", milestone: false, tradeNames: [] };

  // markers: @trade, #stage, efter <task> (each runs until the next marker)
  const marker = /\s(@|#|efter\s)/gi;
  const hits: { kind: string; at: number; len: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = marker.exec(rest))) hits.push({ kind: m[1].trim().toLowerCase(), at: m.index, len: m[0].length });
  let head = hits.length ? rest.slice(0, hits[0].at) : rest;
  hits.forEach((h, i) => {
    const end = i + 1 < hits.length ? hits[i + 1].at : rest.length;
    const text = rest.slice(h.at + h.len, end).trim();
    if (!text) return;
    if (h.kind === "@") out.tradeNames.push(text);
    else if (h.kind === "#") out.stageName = text;
    else out.afterTitle = text;
  });
  rest = head;

  if (/(?:^|\s)(milepæl|milepael|ms)(?=\s|$)/i.test(rest)) {
    out.milestone = true;
    rest = rest.replace(/(?:^|\s)(milepæl|milepael|ms)(?=\s|$)/i, " ");
  }
  const u = UNIT.exec(rest);
  if (u && !out.milestone) {
    const n = parseFloat(u[1].replace(",", "."));
    const unit = u[2].toLowerCase();
    if (unit.startsWith("t")) out.hours = n;
    else if (unit.startsWith("u")) out.days = Math.max(1, Math.round(n * 5));
    else out.days = Math.max(1, Math.round(n));
    rest = rest.replace(UNIT, " ");
  }
  out.title = rest.replace(/\s+/g, " ").trim();
  return out;
}

const norm = (s: string) => s.trim().toLowerCase();

function findByName<T extends { name: string }>(list: T[], name: string): T | undefined {
  const n = norm(name);
  return list.find((x) => norm(x.name) === n) ?? list.find((x) => norm(x.name).startsWith(n)) ?? list.find((x) => norm(x.name).includes(n));
}

export interface QuickAddResult {
  task: Task | null;
  /** things that could not be matched, shown to the user */
  warnings: string[];
}

/** Turns the parsed text into a task. Unknown trades, stages or predecessors are skipped and reported. */
export function buildQuickTask(
  input: string,
  ctx: { trades: Trade[]; stages: Stage[]; tasks: Task[]; hoursPerDay: number; newId: string }
): QuickAddResult {
  const p = parseQuickAdd(input);
  const warnings: string[] = [];
  if (!p.title) return { task: null, warnings: ["Skriv et navn til opgaven."] };

  const tradeIds: string[] = [];
  for (const name of p.tradeNames) {
    const t = findByName(ctx.trades, name);
    if (t) {
      if (!tradeIds.includes(t.id)) tradeIds.push(t.id);
    } else warnings.push(`Faggruppen "${name}" findes ikke`);
  }
  let stageId: string | null = null;
  if (p.stageName) {
    const s = findByName(ctx.stages, p.stageName);
    if (s) stageId = s.id;
    else warnings.push(`Etapen "${p.stageName}" findes ikke`);
  }
  const dependencies: Dependency[] = [];
  if (p.afterTitle) {
    const pred = findByName(ctx.tasks.map((t) => ({ ...t, name: t.title })), p.afterTitle);
    if (pred) dependencies.push({ taskId: pred.id, type: "FS", lag: 0 });
    else warnings.push(`Opgaven "${p.afterTitle}" findes ikke`);
  }

  const hours = p.hours && p.hours > 0 ? Math.max(0.25, p.hours) : undefined;
  const duration = p.milestone ? 0 : hours ? Math.max(1, Math.ceil(hours / ctx.hoursPerDay - 1e-9)) : p.days ?? 1;
  const task: Task = {
    id: ctx.newId,
    title: p.title,
    desc: "",
    manualStart: null,
    duration,
    ...(hours && !p.milestone ? { durationHours: hours } : {}),
    tradeIds,
    dependencyId: dependencies[0]?.taskId ?? null,
    dependencies,
    allowWeekend: false,
    allowHoliday: false,
    weatherIndependent: false,
    stageId,
    isRecurring: false,
    progress: 0,
    isMilestone: p.milestone,
  } as Task;
  return { task, warnings };
}
