import type { Baseline, ProjectInfo, Stage, Task, Trade } from "../../../types.ts";
import { dayNumber, dayToStr, weekdayOf, type Calendar } from "../../../utils/scheduler.ts";
import { taskLinks } from "../../../utils/links.ts";
import { baselineById, endDeviationDays } from "../../../utils/baseline.ts";
import { getTaskSegments } from "../model.ts";

/*
 * Pure layout for the PDF export: turns the plan into a list of drawing primitives per page (millimetres,
 * y pointing down). The renderer (renderPdf.ts) only has to replay them, so this part is fully testable.
 */

export type Paper = "auto" | "A4" | "A3" | "A2" | "A1" | "A0";

/** Landscape sizes [width, height] in mm. */
export const PAPER_MM: Record<Exclude<Paper, "auto">, [number, number]> = {
  A4: [297, 210],
  A3: [420, 297],
  A2: [594, 420],
  A1: [841, 594],
  A0: [1189, 841],
};

/** PDF viewers handle pages up to ~14400 pt (5080 mm); stay a little below it. */
export const MAX_PAGE_MM = 5000;

export interface PdfOptions {
  /** "all" or a stage id. */
  scope: string;
  paper: Paper;
  portrait: boolean;
  /** Millimetres per calendar day (automatic page size only). */
  dayWidth: number;
  arrows: boolean;
  baseline: boolean;
  /** Most tasks on one page; more tasks continue on the next page of the same PDF. */
  maxTasks: number;
}

export const DEFAULT_PDF_OPTIONS: PdfOptions = { scope: "all", paper: "auto", portrait: false, dayWidth: 5, arrows: true, baseline: true, maxTasks: 300 };

export type Prim =
  | { k: "rect"; x: number; y: number; w: number; h: number; fill?: string; stroke?: string; lw?: number; dash?: [number, number] }
  | { k: "line"; x1: number; y1: number; x2: number; y2: number; color: string; lw: number; dash?: [number, number] }
  | { k: "text"; x: number; y: number; s: string; size: number; color: string; bold?: boolean; align?: "left" | "center" | "right" }
  | { k: "poly"; pts: [number, number][]; fill: string }
  | { k: "circle"; x: number; y: number; r: number; fill: string };

export interface PdfPage {
  w: number;
  h: number;
  prims: Prim[];
  /** Number of task rows on this page. */
  taskCount: number;
}

export interface PdfInput {
  tasks: Task[]; // calculated
  trades: Trade[];
  stages: Stage[];
  cal: Calendar;
  weatherRanges: [number, number][];
  baseline?: Baseline | null;
  projectInfo?: ProjectInfo;
  /** Day number of "today". */
  today: number;
  printedAt: Date;
}

export type Measure = (text: string, sizePt: number, bold: boolean) => number;

/** Rough text width in mm for tests and for the dialog's size estimate (Helvetica averages ~0.5 em). */
export const approxMeasure: Measure = (text, size, bold) => text.length * size * 0.3528 * (bold ? 0.56 : 0.5);

// ---------------------------------------------------------------------------------------------- helpers

const COLORS = {
  ink: "#0f172a",
  muted: "#64748b",
  line: "#cbd5e1",
  lineSoft: "#e2e8f0",
  weekend: "#ecfdf5",
  weekendHead: "#d1fae5",
  holiday: "#f3e8ff",
  holidayHead: "#e9d5ff",
  weather: "#e0f2fe",
  weatherHead: "#bae6fd",
  critical: "#dc2626",
  milestone: "#f59e0b",
  today: "#e11d48",
  neutralBar: "#475569",
  baseline: "#94a3b8",
};

const MONTHS_LONG = ["Januar", "Februar", "Marts", "April", "Maj", "Juni", "Juli", "August", "September", "Oktober", "November", "December"];
const MONTHS_SHORT = ["jan", "feb", "mar", "apr", "maj", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];
const WEEKDAY_LETTER = ["S", "M", "T", "O", "T", "F", "L"]; // index = weekdayOf (0 = Sunday)

/** Built-in PDF fonts only cover Latin-1: replace everything else with something safe. */
export function latin1(text: string): string {
  return text
    .replace(/[–—]/g, "-")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/→/g, "->")
    .replace(/…/g, "...")
    .replace(/[^ -~ -ÿ]/g, "?");
}

/** Mixes `hex` with white; t = 0 gives white, 1 gives the colour. */
export function tint(hex: string, t: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return "#e2e8f0";
  const n = parseInt(m[1], 16);
  const mix = (c: number) => Math.round(255 - (255 - c) * t);
  const r = mix((n >> 16) & 255);
  const g = mix((n >> 8) & 255);
  const b = mix(n & 255);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

/** Mixes `hex` with black; t = 0 gives the colour itself, 1 gives black. */
export function darken(hex: string, t: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return "#1e293b";
  const n = parseInt(m[1], 16);
  const mix = (c: number) => Math.round(c * (1 - t));
  return `#${((1 << 24) | (mix((n >> 16) & 255) << 16) | (mix((n >> 8) & 255) << 8) | mix(n & 255)).toString(16).slice(1)}`;
}

const dm = (day: number): string => {
  const [, m, d] = dayToStr(day).split("-");
  return `${Number(d)}/${Number(m)}`;
};

/** ISO week number of a day number. */
export function isoWeek(day: number): number {
  const thursday = day + 3 - ((weekdayOf(day) + 6) % 7);
  const year = new Date(thursday * 86_400_000).getUTCFullYear();
  const jan1 = Math.floor(Date.UTC(year, 0, 1) / 86_400_000);
  return Math.floor((thursday - jan1) / 7) + 1;
}

// ---------------------------------------------------------------------------------------------- rows

type Row =
  | { kind: "stage"; stage: Stage; cont: boolean }
  | { kind: "nostage" }
  | { kind: "task"; task: Task; number: number };

interface Selection {
  rows: Row[];
  taskCount: number;
  minDay: number;
  maxDay: number;
  scopeLabel: string;
}

const scheduledDays = (t: Task): [number, number] | null => {
  const s = dayNumber(t.calcStart);
  const e = dayNumber(t.calcEnd);
  return s !== null && e !== null && e >= s ? [s, e] : null;
};

/** Which rows go in the PDF: grouped by stage (stage row, then its tasks), unstaged tasks last. */
export function selectRows(input: PdfInput, scope: string): Selection {
  const numbered = input.tasks.map((task, i) => ({ task, number: i + 1 })).filter((x) => scheduledDays(x.task));
  const stage = scope === "all" ? undefined : input.stages.find((s) => s.id === scope);

  const inScope = stage
    ? numbered.filter(({ task }) => task.stageId === stage.id || (task.isRecurring && task.recurringStageIds?.includes(stage.id)))
    : numbered;

  const stagesSorted = (stage ? [stage] : input.stages.slice()).sort((a, b) => a.startDate.localeCompare(b.startDate));
  const stageIds = new Set(stagesSorted.map((s) => s.id));

  const rows: Row[] = [];
  for (const st of stagesSorted) {
    const mine = inScope.filter(({ task }) => task.stageId === st.id || (stage && task.isRecurring && task.recurringStageIds?.includes(st.id)));
    if (mine.length === 0 && stage === undefined) continue;
    rows.push({ kind: "stage", stage: st, cont: false });
    for (const m of mine) rows.push({ kind: "task", ...m });
  }
  if (!stage) {
    const loose = inScope.filter(({ task }) => !task.stageId || !stageIds.has(task.stageId));
    if (loose.length > 0) {
      if (stagesSorted.some((s) => rows.some((r) => r.kind === "stage" && r.stage.id === s.id))) rows.push({ kind: "nostage" });
      for (const m of loose) rows.push({ kind: "task", ...m });
    }
  }

  let minDay = Infinity;
  let maxDay = -Infinity;
  for (const { task } of inScope) {
    const [s, e] = scheduledDays(task)!;
    minDay = Math.min(minDay, s);
    maxDay = Math.max(maxDay, e);
  }
  if (!Number.isFinite(minDay) && stage) {
    // a stage without tasks: show its planned period
    minDay = dayNumber(stage.startDate) ?? input.today;
    maxDay = dayNumber(stage.endDate) ?? minDay + 13;
  }
  if (!Number.isFinite(minDay)) {
    minDay = input.today;
    maxDay = input.today + 13;
  }

  return {
    rows,
    taskCount: inScope.length,
    minDay: minDay - 1,
    maxDay: maxDay + 1,
    scopeLabel: stage ? `Etape: ${stage.name}` : "Hele projektet",
  };
}

/** Splits rows into pages of at most `maxTasks` tasks and `maxRows` rows; a stage heading is never left alone at the bottom. */
export function chunkRows(rows: Row[], maxTasks: number, maxRows: number): Row[][] {
  const chunks: Row[][] = [];
  let cur: Row[] = [];
  let tasks = 0;
  let currentStage: Stage | null = null;

  const flush = () => {
    // do not leave a heading as the last row of a page
    const carry: Row[] = [];
    while (cur.length > 1 && cur[cur.length - 1].kind !== "task") carry.unshift(cur.pop()!);
    chunks.push(cur);
    cur = carry;
    tasks = 0;
  };

  for (const row of rows) {
    if (row.kind === "stage") currentStage = row.stage;
    if (row.kind === "nostage") currentStage = null;
    const wouldOverflow = row.kind === "task" ? tasks >= maxTasks || cur.length >= maxRows : cur.length >= maxRows;
    if (wouldOverflow && cur.length > 0) {
      flush();
      if (row.kind === "task" && currentStage && !(cur[0]?.kind === "stage")) cur.unshift({ kind: "stage", stage: currentStage, cont: true });
    }
    cur.push(row);
    if (row.kind === "task") tasks++;
  }
  if (cur.length > 0) chunks.push(cur);
  return chunks.length > 0 ? chunks : [[]];
}

// ---------------------------------------------------------------------------------------------- pages

const M = 8; // outer margin
const TITLE_H = 22;
const ROW_H = 10;
const BAR_TOP = 4.7; // bar top inside a row
const BAR_H = 4.2;
const LABEL_SIZE = 6.5;
const MIN_PAGE_W = 200;

interface LegendItem {
  w: number;
  draw: (x: number, y: number) => Prim[];
}

function flowLegend(items: LegendItem[], width: number, x0: number, y0: number): { prims: Prim[]; height: number } {
  const prims: Prim[] = [];
  let x = x0;
  let y = y0;
  const LINE = 5.2;
  for (const it of items) {
    if (x > x0 && x + it.w > x0 + width) {
      x = x0;
      y += LINE;
    }
    prims.push(...it.draw(x, y));
    x += it.w + 4;
  }
  return { prims, height: y - y0 + LINE };
}

export function layoutPages(input: PdfInput, opts: PdfOptions, measure: Measure = approxMeasure): PdfPage[] {
  const sel = selectRows(input, opts.scope);
  const days = sel.maxDay - sel.minDay + 1;
  const fixed = opts.paper !== "auto";

  // Page width and day width
  let pageW: number;
  let dayW: number;
  if (fixed) {
    const [lw, lh] = PAPER_MM[opts.paper as Exclude<Paper, "auto">];
    pageW = opts.portrait ? lh : lw;
    dayW = (pageW - 2 * M) / days;
  } else {
    dayW = Math.max(0.2, opts.dayWidth);
    pageW = Math.max(MIN_PAGE_W, 2 * M + days * dayW);
  }
  const contentW = pageW - 2 * M;

  const hasMonth = true;
  const hasWeek = dayW * 7 >= 4.5;
  const hasDay = dayW >= 2.2;
  const monthH = 5.5;
  const weekH = hasWeek ? 4.5 : 0;
  const dayH = hasDay ? 7 : 0;
  const headerH = (hasMonth ? monthH : 0) + weekH + dayH;

  // Rows per page
  let maxRows = Infinity;
  let fixedPageH = 0;
  const legendReserve = 24;
  if (fixed) {
    const [lw, lh] = PAPER_MM[opts.paper as Exclude<Paper, "auto">];
    fixedPageH = opts.portrait ? lw : lh;
    maxRows = Math.max(3, Math.floor((fixedPageH - 2 * M - TITLE_H - 3 - headerH - legendReserve) / ROW_H));
  }
  const chunks = chunkRows(sel.rows, Math.max(1, opts.maxTasks), maxRows);

  const bases = opts.baseline ? baselineById(input.baseline) : new Map();
  const tradeById = new Map(input.trades.map((t) => [t.id, t]));
  const showBaseline = opts.baseline && !!input.baseline;

  const pages: PdfPage[] = chunks.map((rows, pageIdx) => {
    const prims: Prim[] = [];
    const taskRows = rows.filter((r): r is Extract<Row, { kind: "task" }> => r.kind === "task");
    const bodyH = Math.max(1, rows.length) * ROW_H;

    // Legend first (its height decides the page height in automatic mode)
    const usedTrades: Trade[] = [];
    const seen = new Set<string>();
    for (const r of taskRows) for (const id of r.task.tradeIds || []) {
      const tr = tradeById.get(id);
      if (tr && !seen.has(id)) {
        seen.add(id);
        usedTrades.push(tr);
      }
    }
    const legendTrades: LegendItem[] = usedTrades.map((tr) => ({
      w: 5 + measure(latin1(tr.name), 7, false),
      draw: (x, y) => [
        { k: "rect", x, y: y + 0.6, w: 3.6, h: 3.2, fill: tr.color || COLORS.neutralBar },
        { k: "text", x: x + 5, y: y + 3.4, s: latin1(tr.name), size: 7, color: COLORS.ink },
      ],
    }));
    const sw = (fill: string, label: string, stroke?: string): LegendItem => ({
      w: 5 + measure(label, 7, false),
      draw: (x, y) => [
        { k: "rect", x, y: y + 0.6, w: 3.6, h: 3.2, fill, stroke, lw: 0.3 },
        { k: "text", x: x + 5, y: y + 3.4, s: label, size: 7, color: COLORS.ink },
      ],
    });
    const symbols: LegendItem[] = [
      sw(COLORS.weekend, "Weekend", COLORS.line),
      sw(COLORS.holiday, "Helligdag/lukkedag", COLORS.line),
      sw(COLORS.weather, "Vejrspildsdag", COLORS.line),
      {
        w: 5 + measure("Milepael", 7, false),
        draw: (x, y) => [
          { k: "poly", pts: [[x + 1.8, y + 0.4], [x + 3.6, y + 2.2], [x + 1.8, y + 4], [x, y + 2.2]], fill: COLORS.milestone },
          { k: "text", x: x + 5, y: y + 3.4, s: "Milepæl", size: 7, color: COLORS.ink },
        ],
      },
      sw("#ffffff", "Kritisk vej (rød kant)", COLORS.critical),
    ];
    if (showBaseline) symbols.push(sw(COLORS.baseline, "Baseline (oprindelig plan)"));
    if (opts.arrows) symbols.push({ w: 6 + measure("Afhaengighed", 7, false), draw: (x, y) => [{ k: "line", x1: x, y1: y + 2.2, x2: x + 4, y2: y + 2.2, color: COLORS.muted, lw: 0.3 }, { k: "text", x: x + 5, y: y + 3.4, s: "Afhængighed", size: 7, color: COLORS.ink }] });
    symbols.push({ w: 4 + measure("I dag", 7, false), draw: (x, y) => [{ k: "line", x1: x + 1, y1: y, x2: x + 1, y2: y + 4.4, color: COLORS.today, lw: 0.5 }, { k: "text", x: x + 3, y: y + 3.4, s: "I dag", size: 7, color: COLORS.ink }] });

    const legendX = M;
    const legendTop0 = 0; // measured relative, then translated below
    const lt = flowLegend(legendTrades, contentW, legendX, legendTop0);
    const ls = flowLegend(symbols, contentW, legendX, legendTop0);
    const legendH = 6 + (legendTrades.length > 0 ? lt.height + 1 : 0) + ls.height;

    const pageH = fixed ? fixedPageH : 2 * M + TITLE_H + 3 + headerH + bodyH + 4 + legendH;
    const bodyTop = M + TITLE_H + 3 + headerH;
    const X = (day: number) => M + (day - sel.minDay) * dayW;
    const rowTop = (i: number) => bodyTop + i * ROW_H;

    // --- body shading (weekends, holidays, weather)
    const shade = (a: number, b: number, fill: string) => {
      if (b < sel.minDay || a > sel.maxDay) return;
      const from = Math.max(a, sel.minDay);
      const to = Math.min(b, sel.maxDay);
      prims.push({ k: "rect", x: X(from), y: bodyTop, w: (to - from + 1) * dayW, h: bodyH, fill });
    };
    for (let d = sel.minDay; d <= sel.maxDay; d++) {
      const wd = weekdayOf(d);
      if (wd === 6) shade(d, Math.min(d + 1, sel.maxDay), COLORS.weekend);
      else if (wd === 0 && d === sel.minDay) shade(d, d, COLORS.weekend);
    }
    for (const day of input.cal.holidays.keys()) shade(day, day, COLORS.holiday);
    for (const [a, b] of input.weatherRanges) shade(a, b, COLORS.weather);

    // --- grid: week lines, and day lines when columns are wide enough
    for (let d = sel.minDay; d <= sel.maxDay + 1; d++) {
      const monday = weekdayOf(d) === 1;
      if (monday || dayW >= 4) prims.push({ k: "line", x1: X(d), y1: bodyTop, x2: X(d), y2: bodyTop + bodyH, color: monday ? COLORS.line : COLORS.lineSoft, lw: monday ? 0.18 : 0.1 });
    }

    // --- rows
    const rowIndexOf = new Map<string, number>();
    rows.forEach((r, i) => {
      if (r.kind === "task") rowIndexOf.set(r.task.id, i);
    });

    const barPos = new Map<string, { x1: number; x2: number; y: number; ms: boolean }>();

    rows.forEach((row, i) => {
      const top = rowTop(i);
      prims.push({ k: "line", x1: M, y1: top + ROW_H, x2: M + contentW, y2: top + ROW_H, color: COLORS.lineSoft, lw: 0.12 });

      if (row.kind === "stage" || row.kind === "nostage") {
        const color = row.kind === "stage" ? row.stage.color : COLORS.baseline;
        const name = row.kind === "stage" ? `${row.stage.name}${row.cont ? " (fortsat)" : ""}` : "Uden etape";
        prims.push({ k: "rect", x: M, y: top, w: contentW, h: ROW_H, fill: tint(color, 0.1) });
        let x = M + 1.5;
        if (row.kind === "stage") {
          const s = dayNumber(row.stage.startDate);
          const e = dayNumber(row.stage.endDate);
          if (s !== null && e !== null && e >= s && e >= sel.minDay && s <= sel.maxDay) {
            const from = Math.max(s, sel.minDay);
            const to = Math.min(e, sel.maxDay);
            prims.push({ k: "rect", x: X(from), y: top + BAR_TOP, w: (to - from + 1) * dayW, h: BAR_H, fill: tint(color, 0.22), stroke: color, lw: 0.3, dash: [1.2, 0.8] });
            x = X(from) + 1.5;
          }
        }
        prims.push({ k: "text", x: Math.min(x, M + contentW - 20), y: top + 3.4, s: latin1(name.toUpperCase()), size: 7, color: tint(color, 1), bold: true });
        return;
      }

      const t = row.task;
      const [s, e] = scheduledDays(t)!;
      const colors = (t.tradeIds || []).map((id) => tradeById.get(id)?.color).filter((c): c is string => !!c);
      const fills = colors.length > 0 ? colors : [COLORS.neutralBar];
      const barY = top + BAR_TOP;
      barPos.set(t.id, { x1: X(s), x2: X(e + 1), y: barY + BAR_H / 2, ms: !!t.isMilestone });

      if (t.isMilestone) {
        const cx = X(s) + dayW / 2;
        const r = BAR_H * 0.62;
        prims.push({ k: "poly", pts: [[cx, barY + BAR_H / 2 - r], [cx + r, barY + BAR_H / 2], [cx, barY + BAR_H / 2 + r], [cx - r, barY + BAR_H / 2]], fill: t.isCritical ? COLORS.critical : COLORS.milestone });
      } else if (t.isRecurring) {
        for (const occ of t.occurrences || []) {
          const d = dayNumber(occ);
          if (d !== null && d >= sel.minDay && d <= sel.maxDay) prims.push({ k: "circle", x: X(d) + dayW / 2, y: barY + BAR_H / 2, r: Math.min(1.6, Math.max(0.5, dayW * 0.45)), fill: fills[0] });
        }
      } else {
        for (const seg of getTaskSegments(t, sel.minDay, sel.maxDay, input.cal)) {
          const x = M + seg.startIndex * dayW;
          const w = (seg.endIndex - seg.startIndex + 1) * dayW;
          if (seg.type === "rest") {
            prims.push({ k: "line", x1: x, y1: barY + BAR_H / 2, x2: x + w, y2: barY + BAR_H / 2, color: COLORS.muted, lw: 0.25, dash: [0.9, 0.7] });
            continue;
          }
          const part = w / fills.length;
          fills.forEach((c, k) => prims.push({ k: "rect", x: x + k * part, y: barY, w: part, h: BAR_H, fill: c }));
          if ((t.progress || 0) > 0) prims.push({ k: "rect", x, y: barY, w: (w * Math.min(100, t.progress || 0)) / 100, h: BAR_H, fill: darken(fills[0], 0.4) });
          prims.push({ k: "rect", x, y: barY, w, h: BAR_H, stroke: t.isCritical ? COLORS.critical : "#334155", lw: t.isCritical ? 0.45 : 0.12 });
        }
      }

      // baseline shadow
      const base = showBaseline ? bases.get(t.id) : undefined;
      if (base && !t.isRecurring) {
        const bs = dayNumber(base.start);
        const be = dayNumber(base.end);
        if (bs !== null && be !== null && be >= sel.minDay && bs <= sel.maxDay) {
          const from = Math.max(bs, sel.minDay);
          const to = Math.min(be, sel.maxDay);
          prims.push({ k: "rect", x: X(from), y: barY + BAR_H + 0.5, w: (to - from + 1) * dayW, h: 0.7, fill: COLORS.baseline });
        }
      }

      // label above the bar: "12. Title | Trades | dates (days)"
      const tradeNames = (t.tradeIds || []).map((id) => tradeById.get(id)?.name).filter(Boolean).join(", ") || "Ingen faggruppe";
      const when = t.isRecurring
        ? `hver ${t.recurringInterval || 7}. dag`
        : t.isMilestone
        ? dm(s)
        : `${dm(s)}-${dm(e)} (${t.duration}d)`;
      const dev = showBaseline ? endDeviationDays(t, base) : null;
      const devText = dev ? ` ${dev > 0 ? "+" : ""}${dev}d` : "";
      const label = latin1(`${row.number}. ${t.title}  |  ${tradeNames}  |  ${when}`);
      const lw = (measure(label, LABEL_SIZE, false) + (devText ? measure(devText, LABEL_SIZE, true) : 0)) * 1.04 + 1;
      let lx = X(s);
      const right = M + contentW;
      if (lx + lw > right) lx = Math.max(M + 0.5, right - lw);
      prims.push({ k: "text", x: lx, y: top + 3.3, s: label, size: LABEL_SIZE, color: t.isCritical ? COLORS.critical : COLORS.ink, bold: false });
      if (devText) prims.push({ k: "text", x: lx + measure(label, LABEL_SIZE, false), y: top + 3.3, s: devText, size: LABEL_SIZE, color: dev! > 0 ? COLORS.critical : "#059669", bold: true });
    });

    // --- dependency arrows (only between rows on this page)
    if (opts.arrows) {
      for (const row of taskRows) {
        const succ = barPos.get(row.task.id);
        if (!succ) continue;
        for (const link of taskLinks(row.task)) {
          const pred = barPos.get(link.taskId);
          const predTask = taskRows.find((r) => r.task.id === link.taskId)?.task;
          if (!pred || !predTask || predTask.isRecurring || row.task.isRecurring) continue;
          const ss = link.type === "SS";
          const x1 = ss ? pred.x1 + (pred.ms ? dayW / 2 : 0) : pred.ms ? pred.x1 + dayW / 2 + 1.5 : pred.x2;
          const x2 = succ.ms ? succ.x1 + dayW / 2 - 1.5 : succ.x1;
          const y1 = pred.y;
          const y2 = succ.y;
          const midY = y2 > y1 ? y2 - ROW_H / 2 + 1.2 : y2 + ROW_H / 2 - 1.2;
          const gap = 1.6;
          const path: [number, number][] = ss
            ? [[x1, y1], [x1 - gap, y1], [x1 - gap, y2], [x2, y2]]
            : x2 >= x1 + 2 * gap
            ? [[x1, y1], [x1 + gap, y1], [x1 + gap, y2], [x2, y2]]
            : [[x1, y1], [x1 + gap, y1], [x1 + gap, midY], [x2 - gap, midY], [x2 - gap, y2], [x2, y2]];
          const critical = !!predTask.isCritical && !!row.task.isCritical;
          const color = critical ? COLORS.critical : COLORS.muted;
          for (let k = 0; k + 1 < path.length; k++) {
            prims.push({ k: "line", x1: path[k][0], y1: path[k][1], x2: path[k + 1][0], y2: path[k + 1][1], color, lw: 0.22, dash: ss ? [0.8, 0.6] : undefined });
          }
          prims.push({ k: "poly", pts: [[x2, y2], [x2 - 1.4, y2 - 0.8], [x2 - 1.4, y2 + 0.8]], fill: color });
        }
      }
    }

    // --- today line
    if (input.today >= sel.minDay && input.today <= sel.maxDay) {
      const x = X(input.today) + dayW / 2;
      prims.push({ k: "line", x1: x, y1: bodyTop - 1, x2: x, y2: bodyTop + bodyH, color: COLORS.today, lw: 0.4, dash: [1.5, 1] });
    }

    // --- calendar header
    let y = M + TITLE_H + 3;
    // months
    let d = sel.minDay;
    while (d <= sel.maxDay) {
      const dt = new Date(d * 86_400_000);
      const y0 = dt.getUTCFullYear();
      const m0 = dt.getUTCMonth();
      const next = Math.floor(Date.UTC(y0, m0 + 1, 1) / 86_400_000);
      const to = Math.min(next - 1, sel.maxDay);
      const w = (to - d + 1) * dayW;
      const long = `${MONTHS_LONG[m0]} ${y0}`;
      const label = measure(long, 7, true) + 2 <= w ? long : measure(`${MONTHS_SHORT[m0]} ${String(y0).slice(2)}`, 7, true) + 1.5 <= w ? `${MONTHS_SHORT[m0]} ${String(y0).slice(2)}` : measure(MONTHS_SHORT[m0][0].toUpperCase(), 7, true) + 1 <= w ? MONTHS_SHORT[m0][0].toUpperCase() : "";
      prims.push({ k: "rect", x: X(d), y, w, h: monthH, fill: m0 % 2 ? "#f1f5f9" : "#e2e8f0", stroke: COLORS.line, lw: 0.15 });
      if (label) prims.push({ k: "text", x: X(d) + w / 2, y: y + 3.8, s: label, size: 7, color: COLORS.ink, bold: true, align: "center" });
      d = to + 1;
    }
    y += monthH;
    // weeks
    if (hasWeek) {
      d = sel.minDay;
      while (d <= sel.maxDay) {
        const to = Math.min(d + ((7 - weekdayOf(d)) % 7), sel.maxDay); // through Sunday
        const w = (to - d + 1) * dayW;
        prims.push({ k: "rect", x: X(d), y, w, h: weekH, fill: "#f8fafc", stroke: COLORS.line, lw: 0.12 });
        const wk = isoWeek(d);
        const label = measure(`u${wk}`, 5.5, false) + 1 <= w ? `u${wk}` : measure(String(wk), 5.5, false) + 0.8 <= w ? String(wk) : "";
        if (label) prims.push({ k: "text", x: X(d) + w / 2, y: y + 3.2, s: label, size: 5.5, color: COLORS.muted, align: "center" });
        d = to + 1;
      }
      y += weekH;
    }
    // days
    if (hasDay) {
      for (let day = sel.minDay; day <= sel.maxDay; day++) {
        const wd = weekdayOf(day);
        const hol = input.cal.isHoliday(day);
        const weather = input.cal.isWeatherDay(day);
        const fill = hol ? COLORS.holidayHead : weather ? COLORS.weatherHead : wd === 0 || wd === 6 ? COLORS.weekendHead : "#ffffff";
        prims.push({ k: "rect", x: X(day), y, w: dayW, h: dayH, fill, stroke: COLORS.line, lw: 0.1 });
        const size = Math.min(6, Math.max(3.5, dayW * 1.6));
        prims.push({ k: "text", x: X(day) + dayW / 2, y: y + 2.7, s: WEEKDAY_LETTER[wd], size: size * 0.8, color: COLORS.muted, align: "center" });
        prims.push({ k: "text", x: X(day) + dayW / 2, y: y + 5.9, s: String(new Date(day * 86_400_000).getUTCDate()), size, color: COLORS.ink, bold: true, align: "center" });
      }
    }

    // --- title block
    const info = input.projectInfo;
    const name = latin1(info?.projectName || "Projekt");
    const sub = latin1([info?.address, info?.customer ? `Kunde: ${info.customer}` : "", info?.manager ? `Ansvarlig: ${info.manager}` : ""].filter(Boolean).join("   |   "));
    prims.push({ k: "text", x: M, y: M + 8, s: name, size: 18, color: COLORS.ink, bold: true });
    if (sub) prims.push({ k: "text", x: M, y: M + 13.5, s: sub, size: 8, color: COLORS.muted });
    const right = M + contentW;
    const printed = input.printedAt;
    const stamp = `${printed.getDate()}/${printed.getMonth() + 1}/${printed.getFullYear()}`;
    prims.push({ k: "text", x: right, y: M + 6, s: latin1(sel.scopeLabel), size: 9, color: COLORS.ink, bold: true, align: "right" });
    prims.push({ k: "text", x: right, y: M + 11, s: `${dm(sel.minDay + 1)}/${dayToStr(sel.minDay + 1).slice(0, 4)} - ${dm(sel.maxDay - 1)}/${dayToStr(sel.maxDay - 1).slice(0, 4)}`, size: 7.5, color: COLORS.muted, align: "right" });
    prims.push({ k: "text", x: right, y: M + 15.5, s: `Opgaver: ${taskRows.length} af ${sel.taskCount}   |   Side ${pageIdx + 1} af ${chunks.length}`, size: 7.5, color: COLORS.muted, align: "right" });
    prims.push({ k: "text", x: right, y: M + 20, s: `Udskrevet ${stamp}`, size: 7, color: COLORS.muted, align: "right" });
    prims.push({ k: "line", x1: M, y1: M + TITLE_H - 1, x2: right, y2: M + TITLE_H - 1, color: COLORS.ink, lw: 0.5 });

    // --- outer frame around the grid
    prims.push({ k: "rect", x: M, y: M + TITLE_H + 3, w: contentW, h: headerH + bodyH, stroke: COLORS.muted, lw: 0.3 });

    // --- legend
    const legendTop = bodyTop + bodyH + 4;
    let ly = legendTop;
    prims.push({ k: "line", x1: M, y1: legendTop - 1, x2: right, y2: legendTop - 1, color: COLORS.lineSoft, lw: 0.2 });
    const shift = (list: Prim[], dy: number): Prim[] =>
      list.map((p) => {
        switch (p.k) {
          case "line": return { ...p, y1: p.y1 + dy, y2: p.y2 + dy };
          case "poly": return { ...p, pts: p.pts.map(([px, py]) => [px, py + dy] as [number, number]) };
          default: return { ...p, y: p.y + dy };
        }
      });
    if (legendTrades.length > 0) {
      prims.push({ k: "text", x: M, y: ly + 2.4, s: "Faggrupper:", size: 6.5, color: COLORS.muted, bold: true });
      const flow = flowLegend(legendTrades, contentW - 22, M + 22, 0);
      prims.push(...shift(flow.prims, ly));
      ly += flow.height + 1;
    }
    prims.push(...shift(ls.prims, ly));

    return { w: pageW, h: pageH, prims, taskCount: taskRows.length };
  });

  // Very large projects: scale the whole page down so PDF viewers can open it
  return pages.map((p) => {
    const s = Math.min(1, MAX_PAGE_MM / Math.max(p.w, p.h));
    return s < 1 ? scalePage(p, s) : p;
  });
}

export function scalePage(page: PdfPage, s: number): PdfPage {
  const prims = page.prims.map((p): Prim => {
    switch (p.k) {
      case "rect": return { ...p, x: p.x * s, y: p.y * s, w: p.w * s, h: p.h * s, lw: p.lw === undefined ? undefined : p.lw * s, dash: p.dash && [p.dash[0] * s, p.dash[1] * s] };
      case "line": return { ...p, x1: p.x1 * s, y1: p.y1 * s, x2: p.x2 * s, y2: p.y2 * s, lw: p.lw * s, dash: p.dash && [p.dash[0] * s, p.dash[1] * s] };
      case "text": return { ...p, x: p.x * s, y: p.y * s, size: p.size * s };
      case "poly": return { ...p, pts: p.pts.map(([x, y]) => [x * s, y * s] as [number, number]) };
      case "circle": return { ...p, x: p.x * s, y: p.y * s, r: p.r * s };
    }
  });
  return { ...page, w: page.w * s, h: page.h * s, prims };
}
