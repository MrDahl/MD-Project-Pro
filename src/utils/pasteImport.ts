import type { Dependency, Stage, Task, Trade } from "../types.ts";
import { withLinks } from "./links.ts";
import { detectCycle } from "./scheduler.ts";

export interface ImportResult {
  tasks: Task[];
  newTrades: Trade[];
  newStages: Stage[];
  warnings: string[];
  /** Data rows read (before skipping empty ones) */
  rows: number;
}

export interface ImportContext {
  trades: Trade[];
  stages: Stage[];
  startDate: string;
}

const TRADE_COLORS = ["#0ea5e9", "#f59e0b", "#10b981", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316", "#6366f1", "#84cc16", "#06b6d4", "#a855f7"];
const STAGE_COLORS = ["#475569", "#0369a1", "#15803d", "#b45309", "#7c3aed", "#be123c", "#0f766e"];
export const MAX_IMPORT_ROWS = 3000;

/** Splits pasted text (Excel = tabs, CSV = ; or ,) into cells. Understands "quoted ""cells"" with line breaks". */
export function parseTable(text: string): string[][] {
  const clean = text.replace(/^﻿/, "");
  const firstLine = clean.split(/\r?\n/, 1)[0] ?? "";
  const delim = firstLine.includes("\t") ? "\t" : (firstLine.match(/;/g) || []).length >= (firstLine.match(/,/g) || []).length && firstLine.includes(";") ? ";" : firstLine.includes(",") ? "," : "\t";
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (quoted) {
      if (ch === '"') {
        if (clean[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else cell += ch;
    } else if (ch === '"' && cell === "") quoted = true;
    else if (ch === delim) {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && clean[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  if (cell !== "" || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows.map((r) => r.map((c) => c.trim())).filter((r) => r.some((c) => c !== ""));
}

type Col = "id" | "title" | "duration" | "pred" | "trade" | "stage" | "start";
const HEADERS: [Col, RegExp][] = [
  ["id", /^(id|nr\.?|nummer|kode|key)$/],
  ["title", /^(opgave|opgaver|titel|navn|aktivitet|task|beskrivelse)\b/],
  ["duration", /^(varighed|dage|uger|duration|arbejdsdage)\b/],
  ["pred", /^(forg[aæ]nger|afh[aæ]ngig|afh[aæ]ngighed|efter|predecessor)/],
  ["trade", /^(faggruppe|fag|fag-kategori|ressource|resurse|entreprise|trade)/],
  ["stage", /^(etape|fase|zone|stage)\b/],
  ["start", /^(start|startdato|tidligst)\b/],
];

function detectColumns(first: string[]): { map: Partial<Record<Col, number>>; header: boolean; weeks: boolean } {
  const map: Partial<Record<Col, number>> = {};
  first.forEach((cell, i) => {
    const c = cell.toLocaleLowerCase("da-DK").trim();
    for (const [col, re] of HEADERS) if (map[col] === undefined && re.test(c)) { map[col] = i; break; }
  });
  const header = map.title !== undefined || Object.keys(map).length >= 2;
  if (!header) return { map: { title: 0, duration: 1, pred: 2, trade: 3, stage: 4 }, header: false, weeks: false };
  const weeks = map.duration !== undefined && /uge/i.test(first[map.duration]);
  return { map, header: true, weeks };
}

/** "3", "3 dage", "2 uger", "2u", "1,5" => working days; null when unreadable. */
export function parseDuration(raw: string, weeksDefault: boolean): number | null {
  const m = raw.trim().toLocaleLowerCase("da-DK").match(/^(\d+(?:[.,]\d+)?)\s*(uger|uge|u|w|dage|dag|d)?\.?$/);
  if (!m) return null;
  const n = parseFloat(m[1].replace(",", "."));
  const weeks = m[2] ? /^(u|w|uge|uger)$/.test(m[2]) : weeksDefault;
  return Math.round(n * (weeks ? 5 : 1));
}

function parseDate(raw: string): string | null {
  const s = raw.trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  let y: number, mo: number, d: number;
  if (m) [y, mo, d] = [+m[1], +m[2], +m[3]];
  else if ((m = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/))) [d, mo, y] = [+m[1], +m[2], +m[3] < 100 ? 2000 + +m[3] : +m[3]];
  else return null;
  const dt = new Date(Date.UTC(y, mo - 1, d, 12));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  return dt.toISOString().slice(0, 10);
}

const lc = (s: string) => s.toLocaleLowerCase("da-DK").trim();
const splitList = (s: string, re: RegExp) => s.split(re).map((x) => x.trim()).filter(Boolean);

/** Turns pasted rows into tasks. Unknown trades/stages are created; unreadable parts are reported, never thrown. */
export function importFromText(text: string, ctx: ImportContext): ImportResult {
  const warnings: string[] = [];
  const table = parseTable(text);
  if (table.length === 0) return { tasks: [], newTrades: [], newStages: [], warnings: ["Der er ingen rækker at indsætte."], rows: 0 };

  const { map, header, weeks } = detectColumns(table[0]);
  let data = header ? table.slice(1) : table;
  if (data.length > MAX_IMPORT_ROWS) {
    warnings.push(`Kun de første ${MAX_IMPORT_ROWS} rækker bruges (der var ${data.length}).`);
    data = data.slice(0, MAX_IMPORT_ROWS);
  }
  const cell = (r: string[], c: Col) => (map[c] === undefined ? "" : (r[map[c]!] ?? "").trim());

  const trades = new Map(ctx.trades.map((t) => [lc(t.name), t]));
  const stages = new Map(ctx.stages.map((s) => [lc(s.name), s]));
  const newTrades: Trade[] = [];
  const newStages: Stage[] = [];
  const stamp = Date.now().toString(36);

  const tradeFor = (name: string): Trade => {
    let t = trades.get(lc(name));
    if (!t) {
      t = {
        id: `trade-imp-${stamp}-${newTrades.length + 1}`,
        name,
        rate: 400,
        isFixedPrice: false,
        weekendSupplement: 50,
        holidaySupplement: 100,
        color: TRADE_COLORS[(ctx.trades.length + newTrades.length) % TRADE_COLORS.length],
      };
      trades.set(lc(name), t);
      newTrades.push(t);
    }
    return t;
  };
  const stageFor = (name: string): Stage => {
    let s = stages.get(lc(name));
    if (!s) {
      s = {
        id: `stage-imp-${stamp}-${newStages.length + 1}`,
        name,
        color: STAGE_COLORS[(ctx.stages.length + newStages.length) % STAGE_COLORS.length],
        startDate: ctx.startDate,
        endDate: ctx.startDate,
      };
      stages.set(lc(name), s);
      newStages.push(s);
    }
    return s;
  };

  // First pass: ids, so predecessors may point forward
  const entries: { row: string[]; n: number; id: string }[] = [];
  const byKey = new Map<string, string>(); // id column / title / row number -> task id
  data.forEach((row, i) => {
    const title = cell(row, "title");
    if (!title) {
      warnings.push(`Række ${i + (header ? 2 : 1)} springes over: mangler opgavenavn.`);
      return;
    }
    const id = `task-imp-${stamp}-${entries.length + 1}`;
    entries.push({ row, n: i + 1, id });
    const key = cell(row, "id");
    if (key) byKey.set(lc(key), id);
    if (!byKey.has(lc(title))) byKey.set(lc(title), id);
    byKey.set(`#${i + 1}`, id);
  });

  const tasks: Task[] = entries.map(({ row, n, id }) => {
    const title = cell(row, "title");
    const where = `"${title}"`;
    let duration = 1;
    let milestone = false;
    const durRaw = cell(row, "duration");
    if (durRaw === "") warnings.push(`${where}: ingen varighed - sat til 1 dag.`);
    else {
      const d = parseDuration(durRaw, weeks);
      if (d === null) warnings.push(`${where}: varigheden "${durRaw}" kan ikke læses - sat til 1 dag.`);
      else if (d === 0) milestone = true;
      else duration = d;
    }

    const links: Dependency[] = [];
    for (const tok of splitList(cell(row, "pred"), /[,;/]|\s+og\s+/i)) {
      if (/^\(.*\)$/.test(tok) || /^(ingen|-|–)$/i.test(tok)) continue;
      const whole = byKey.has(lc(tok));
      const m = whole ? null : tok.match(/^(.*?)\s*(?:(FS|SS)\s*([+-]\s*\d+)?)?$/i);
      const ref = whole ? tok : (m?.[1] ?? tok).trim();
      const type = (m?.[2] ?? "FS").toUpperCase() as "FS" | "SS";
      const lag = m?.[3] ? parseInt(m[3].replace(/\s+/g, ""), 10) : 0;
      const target = byKey.get(lc(ref)) ?? (/^\d+$/.test(ref) ? byKey.get(`#${ref}`) : undefined);
      if (!target) warnings.push(`${where}: forgængeren "${ref}" findes ikke og springes over.`);
      else if (target === id) warnings.push(`${where}: kan ikke være sin egen forgænger.`);
      else if (!links.some((l) => l.taskId === target)) links.push({ taskId: target, type, lag });
    }

    const tradeIds = splitList(cell(row, "trade"), /[,+/]/).map((name) => tradeFor(name).id);
    const stageName = cell(row, "stage");
    const startRaw = cell(row, "start");
    let manualStart: string | null = null;
    if (startRaw) {
      manualStart = parseDate(startRaw);
      if (!manualStart) warnings.push(`${where}: startdatoen "${startRaw}" kan ikke læses og ignoreres.`);
    }
    void n;
    return withLinks(
      {
        id,
        title,
        desc: "",
        duration: milestone ? 0 : duration,
        manualStart,
        tradeIds: [...new Set(tradeIds)],
        dependencyId: null,
        allowWeekend: false,
        allowHoliday: false,
        stageId: stageName ? stageFor(stageName).id : null,
        isMilestone: milestone,
        progress: 0,
      },
      links
    );
  });

  // A loop among the pasted tasks would make the plan unusable: drop the links instead of importing a broken plan
  if (tasks.length > 0 && detectCycle(tasks)) {
    warnings.push("Forgængerne danner en løkke (A venter på B, B venter på A). Alle forgængere er derfor udeladt - ret dem og prøv igen.");
    return { tasks: tasks.map((t) => withLinks(t, [])), newTrades, newStages, warnings, rows: data.length };
  }
  return { tasks, newTrades, newStages, warnings, rows: data.length };
}
