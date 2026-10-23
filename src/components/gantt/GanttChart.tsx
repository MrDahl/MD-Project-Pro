import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { Task, Trade, Stage, WeatherDelay, Holiday, Baseline, ProjectInfo } from "../../types";
import { baselineById, endDeviationDays } from "../../utils/baseline";
import { buildCalendar, dayNumber, dayToStr, isWeekendDay, weekdayOf } from "../../utils/scheduler";
import { Calendar, Zap, ChevronLeft, ChevronRight, FolderDown, Flame, SlidersHorizontal, ZoomIn, Link2, FileText } from "lucide-react";
import { todayStr } from "../../utils/dates";
import { taskLinks } from "../../utils/links";
import {
  ZOOM_COL_W,
  ROW_H,
  HEADER_H,
  LABEL_W,
  LABEL_W_COLLAPSED,
  computeViewRange,
  indexBy,
  isScheduled,
  monthsBetween,
  projectBounds,
  stripCalculated,
  yearsBetween,
  type FilterState,
  type Zoom,
  type ScopeType,
} from "./model";
import { applyMove, applyResize } from "./drag";
import { exportFullGantt } from "./exportGantt";
import { PdfExportDialog } from "./pdf/PdfExportDialog";
import { buildPdf, downloadBlob } from "./pdf/exportPdf";
import type { PdfInput, PdfOptions } from "./pdf/layout";
import { GanttStageRow, GanttTaskRow } from "./GanttRows";
import { DayActionModal } from "./DayActionModal";
import { TaskDetailModal } from "./TaskDetailModal";

interface GanttChartProps {
  tasks: Task[];
  trades: Trade[];
  holidays: Holiday[];
  projectStartDate: string;
  stages?: Stage[];
  weatherDelays?: WeatherDelay[];
  baseline?: Baseline | null;
  projectInfo?: ProjectInfo;
  onSaveBaseline: () => void;
  onClearBaseline: () => void;
  /** `newGesture` is true for the first change of a drag, so the whole drag becomes one undo step. */
  onUpdateTasks: (updatedTasks: Task[], newGesture: boolean) => void;
  onEditTask: (task: Task) => void;
  onAddHoliday: (date: string, name: string) => void;
  onDeleteHoliday: (idx: number) => void;
  onAddWeatherDelay: (label: string, start: string, end: string) => void;
  onDeleteWeatherDelay: (id: string) => void;
}

interface DragState {
  taskId: string;
  type: "move" | "resize-right";
  startX: number;
  /** Start column (move) or duration (resize) when the drag began. */
  startValue: number;
  /** Untouched tasks from when the drag began - every step is computed from these. */
  baseline: Task[];
  lastDelta: number;
  /** True once the pointer has travelled far enough to count as a drag instead of a click. */
  moved: boolean;
  /** True once the first change of this drag has been reported (it becomes the undo step). */
  recorded: boolean;
}

const EMPTY_STAGES: Stage[] = [];
const EMPTY_DELAYS: WeatherDelay[] = [];

const dayTitleFmt = new Intl.DateTimeFormat("da-DK", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
const MONTHS_SHORT = ["jan", "feb", "mar", "apr", "maj", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];

/** Only rows/columns near the viewport are rendered, so cost no longer grows with project size. */
const COL_OVERSCAN = 12;
const ROW_OVERSCAN = 6;
const COL_SNAP = 8;
const ROW_SNAP = 4;

export function GanttChart({
  tasks,
  trades,
  holidays,
  projectStartDate,
  stages = EMPTY_STAGES,
  weatherDelays = EMPTY_DELAYS,
  baseline = null,
  projectInfo,
  onSaveBaseline,
  onClearBaseline,
  onUpdateTasks,
  onEditTask,
  onAddHoliday,
  onDeleteHoliday,
  onAddWeatherDelay,
  onDeleteWeatherDelay,
}: GanttChartProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [columnCollapsed, setColumnCollapsed] = useState(false);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [detailTask, setDetailTask] = useState<Task | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [zoom, setZoom] = useState<Zoom>("day");
  const [showArrows, setShowArrows] = useState(true);
  const [collapsedStages, setCollapsedStages] = useState<Set<string>>(() => new Set());
  const toggleStage = useCallback(
    (id: string) =>
      setCollapsedStages((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      }),
    []
  );
  const [showBaseline, setShowBaseline] = useState(true);
  const [pdfOpen, setPdfOpen] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [jumpTo, setJumpTo] = useState<number | null>(null);
  const zoomAnchor = useRef<number | null>(null);
  const colW = ZOOM_COL_W[zoom];

  // --- Focus area filter ---
  const [filter, setFilter] = useState<FilterState>({ scope: "all", stageId: "", monthStr: "", yearVal: 0 });
  const setFilterScope = (scope: ScopeType) => setFilter((f) => ({ ...f, scope }));
  const setSelectedStageId = (stageId: string) => setFilter((f) => ({ ...f, stageId }));
  const setSelectedMonthStr = (monthStr: string) => setFilter((f) => ({ ...f, monthStr }));
  const setSelectedYearVal = (yearVal: number) => setFilter((f) => ({ ...f, yearVal }));

  // --- Derived, memoised data ---
  const cal = useMemo(() => buildCalendar(holidays, weatherDelays), [holidays, weatherDelays]);
  const tradeById = useMemo(() => indexBy(trades), [trades]);
  const stageById = useMemo(() => indexBy(stages), [stages]);
  const taskNumber = useMemo(() => {
    const m = new Map<string, number>();
    tasks.forEach((t, i) => {
      if (!m.has(t.id)) m.set(t.id, i + 1);
    });
    return m;
  }, [tasks]);

  const scheduled = useMemo(() => tasks.filter(isScheduled), [tasks]);
  const baseTasks = useMemo(() => baselineById(baseline), [baseline]);
  const baseSpans = useMemo(() => {
    const m = new Map<string, { start: number; end: number }>();
    for (const [id, b] of baseTasks) {
      const start = dayNumber(b.start);
      const end = dayNumber(b.end);
      if (start !== null && end !== null) m.set(id, { start, end });
    }
    return m;
  }, [baseTasks]);
  const bounds = useMemo(() => projectBounds(scheduled, projectStartDate), [scheduled, projectStartDate]);
  const availableMonths = useMemo(() => monthsBetween(bounds.min, bounds.max), [bounds.min, bounds.max]);
  const availableYears = useMemo(() => yearsBetween(bounds.min, bounds.max), [bounds.min, bounds.max]);

  const filterScope = filter.scope;
  const selectedStageId = filter.stageId || stages[0]?.id || "";
  const selectedMonthStr = filter.monthStr || availableMonths[0]?.val || "";
  const selectedYearVal = filter.yearVal || availableYears[0] || 0;

  const { minDay, maxDay } = useMemo(
    () =>
      computeViewRange(scheduled, projectStartDate, stages, {
        scope: filterScope,
        stageId: selectedStageId,
        monthStr: selectedMonthStr,
        yearVal: selectedYearVal,
      }),
    [scheduled, projectStartDate, stages, filterScope, selectedStageId, selectedMonthStr, selectedYearVal]
  );
  const days = Math.max(0, maxDay - minDay + 1);

  const visibleStages = useMemo(
    () =>
      stages.filter((s) => {
        const a = dayNumber(s.startDate);
        const b = dayNumber(s.endDate);
        return a !== null && b !== null && a <= maxDay && b >= minDay;
      }),
    [stages, minDay, maxDay]
  );
  const visibleTasks = useMemo(
    () =>
      scheduled.filter((t) => {
        if (t.stageId && collapsedStages.has(t.stageId)) return false;
        const a = dayNumber(t.calcStart);
        const b = dayNumber(t.calcEnd);
        return a !== null && b !== null && a <= maxDay && b >= minDay;
      }),
    [scheduled, minDay, maxDay, collapsedStages]
  );
  const stageTaskCount = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of scheduled) if (t.stageId) m.set(t.stageId, (m.get(t.stageId) ?? 0) + 1);
    return m;
  }, [scheduled]);
  const rowCount = visibleStages.length + visibleTasks.length;

  // Dependency arrows (finish -> start). Built once per layout; only the ones near the viewport are drawn.
  const arrows = useMemo(() => {
    const rowOf = new Map<string, number>();
    const taskById = new Map<string, Task>();
    visibleTasks.forEach((t, i) => {
      rowOf.set(t.id, visibleStages.length + i);
      taskById.set(t.id, t);
    });
    const list: { key: string; d: string; head: string; lo: number; hi: number; xLo: number; xHi: number; critical: boolean; dashed: boolean }[] = [];
    for (const t of visibleTasks) {
      if (t.isRecurring) continue;
      const succStart = dayNumber(t.calcStart);
      if (succStart === null) continue;
      for (const link of taskLinks(t)) {
        const pred = taskById.get(link.taskId);
        if (!pred || pred.isRecurring) continue;
        const predEnd = dayNumber(pred.calcEnd);
        const predStart = dayNumber(pred.calcStart);
        if (predEnd === null || predStart === null) continue;
        const rp = rowOf.get(pred.id)!;
        const rs = rowOf.get(t.id)!;
        const ss = link.type === "SS";
        const x1 = ss
          ? (pred.isMilestone ? (predStart - minDay) * colW + colW / 2 - 10 : (predStart - minDay) * colW)
          : pred.isMilestone
          ? (predEnd - minDay) * colW + colW / 2 + 10
          : (predEnd - minDay + 1) * colW;
        const x2 = t.isMilestone ? (succStart - minDay) * colW + colW / 2 - 10 : (succStart - minDay) * colW;
        const y1 = rp * ROW_H + ROW_H / 2;
        const y2 = rs * ROW_H + ROW_H / 2;
        const midY = y2 > y1 ? y2 - ROW_H / 2 : y2 + ROW_H / 2;
        const d = ss
          ? x2 >= x1 - 8
            ? `M${x1} ${y1}H${x1 - 8}V${midY}H${x2 - 8}V${y2}H${x2}`
            : `M${x1} ${y1}H${x1 - 8}V${y2}H${x2}`
          : x2 >= x1 + 16
          ? `M${x1} ${y1}H${x1 + 8}V${y2}H${x2}`
          : `M${x1} ${y1}H${x1 + 8}V${midY}H${x2 - 8}V${y2}H${x2}`;
        list.push({
          key: `${pred.id}>${t.id}`,
          d,
          head: `${x2},${y2} ${x2 - 6},${y2 - 3.5} ${x2 - 6},${y2 + 3.5}`,
          lo: Math.min(rp, rs),
          hi: Math.max(rp, rs),
          xLo: Math.min(x1, x2) - 10,
          xHi: Math.max(x1, x2) + 10,
          critical: !!pred.isCritical && !!t.isCritical,
          dashed: ss,
        });
      }
    }
    return list;
  }, [visibleTasks, visibleStages.length, minDay, colW]);

  const labelW = columnCollapsed ? LABEL_W_COLLAPSED : LABEL_W;
  const timelineWidth = days * colW;
  const totalWidth = labelW + timelineWidth;

  // --- Windowing: which rows/columns are near the viewport ---
  const [win, setWin] = useState({ firstCol: 0, lastCol: 60, firstRow: 0, lastRow: 24 });
  const dims = useRef({ days, rowCount, labelW, colW });
  dims.current = { days, rowCount, labelW, colW };
  const frame = useRef(0);

  const measure = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const { days: d, rowCount: r, labelW: lw, colW: cw } = dims.current;

    const left = el.scrollLeft - lw;
    const firstCol = Math.max(0, Math.floor((Math.floor(left / cw) - COL_OVERSCAN) / COL_SNAP) * COL_SNAP);
    const lastCol = Math.min(d - 1, Math.ceil((Math.ceil((left + el.clientWidth) / cw) + COL_OVERSCAN) / COL_SNAP) * COL_SNAP);

    const top = el.scrollTop - HEADER_H;
    const firstRow = Math.max(0, Math.floor((Math.floor(top / ROW_H) - ROW_OVERSCAN) / ROW_SNAP) * ROW_SNAP);
    const lastRow = Math.min(r - 1, Math.ceil((Math.ceil((top + el.clientHeight) / ROW_H) + ROW_OVERSCAN) / ROW_SNAP) * ROW_SNAP);

    setWin((p) =>
      p.firstCol === firstCol && p.lastCol === lastCol && p.firstRow === firstRow && p.lastRow === lastRow
        ? p
        : { firstCol, lastCol, firstRow, lastRow }
    );
  }, []);

  const handleScroll = useCallback(() => {
    if (frame.current) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = 0;
      measure();
    });
  }, [measure]);

  useLayoutEffect(() => {
    measure();
  }, [measure, days, rowCount, columnCollapsed, scheduled.length, colW]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => measure());
    ro.observe(el);
    return () => {
      ro.disconnect();
      if (frame.current) cancelAnimationFrame(frame.current);
    };
  }, [measure, scheduled.length]);

  // --- Drag & resize (computed from a baseline; state updates only when the column delta changes) ---
  const dragRef = useRef<DragState | null>(null);
  const live = useRef({ tasks, minDay, maxDay, onUpdateTasks, colW, visibleTasks, stageCount: visibleStages.length });
  live.current = { tasks, minDay, maxDay, onUpdateTasks, colW, visibleTasks, stageCount: visibleStages.length };

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>, task: Task, type: "move" | "resize-right") => {
      e.preventDefault();
      e.stopPropagation();
      e.currentTarget.setPointerCapture(e.pointerId);

      const startDay = dayNumber(task.calcStart);
      dragRef.current = {
        taskId: task.id,
        type,
        startX: e.clientX,
        startValue: type === "move" ? (startDay !== null ? startDay - live.current.minDay : 0) : task.duration,
        baseline: live.current.tasks.map(stripCalculated),
        lastDelta: 0,
        moved: false,
        recorded: false,
      };
      setDraggingId(task.id);
    },
    []
  );

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    e.preventDefault();
    e.stopPropagation();

    if (e.buttons === 0) {
      // pointer was released/cancelled elsewhere
      dragRef.current = null;
      setDraggingId(null);
      return;
    }

    if (Math.abs(e.clientX - drag.startX) >= 3) drag.moved = true;

    const delta = Math.round((e.clientX - drag.startX) / live.current.colW);
    if (delta === drag.lastDelta) return;
    drag.lastDelta = delta;

    const { minDay: lo, maxDay: hi, onUpdateTasks } = live.current;
    const update = (next: Task[]) => {
      onUpdateTasks(next, !drag.recorded);
      drag.recorded = true;
    };
    if (delta === 0) {
      update(drag.baseline); // back at the starting column: restore the original plan exactly
    } else if (drag.type === "move") {
      const index = Math.max(0, Math.min(hi - lo, drag.startValue + delta));
      update(applyMove(drag.baseline, drag.taskId, dayToStr(lo + index), delta));
    } else {
      update(applyResize(drag.baseline, drag.taskId, drag.startValue + delta));
    }
  }, []);

  const handlePointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>, task: Task) => {
    const drag = dragRef.current;
    if (!drag) return;
    e.preventDefault();
    e.stopPropagation();

    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* capture already released */
    }

    const wasClick = !drag.moved;
    dragRef.current = null;
    setDraggingId(null);

    // A short click opens the details, a drag changes the schedule
    if (wasClick) setDetailTask(task);
  }, []);

  const expandColumn = useCallback(() => setColumnCollapsed(false), []);
  const openDetail = useCallback((t: Task) => setDetailTask(t), []);

  // --- Background: weekend stripes via CSS, holidays/weather as a few overlay blocks ---
  const overlays = useMemo(() => {
    const holidayCols: number[] = [];
    for (const day of cal.holidays.keys()) if (day >= minDay && day <= maxDay) holidayCols.push(day - minDay);
    const weather: { left: number; width: number }[] = [];
    for (const [a, b] of cal.weatherRanges) {
      const from = Math.max(a, minDay);
      const to = Math.min(b, maxDay);
      if (from <= to) weather.push({ left: (from - minDay) * colW, width: (to - from + 1) * colW });
    }
    return { holidayCols, weather };
  }, [cal, minDay, maxDay, colW]);

  const weekendColor = "rgba(236,253,245,0.55)";
  const gridBackground: React.CSSProperties = {
    backgroundImage: [
      colW >= 24 ? `linear-gradient(to right, transparent ${colW - 1}px, rgba(226,232,240,0.6) ${colW - 1}px)` : "none",
      `linear-gradient(to right, ${weekendColor} 0, ${weekendColor} ${colW}px, transparent ${colW}px, transparent ${colW * 6}px, ${weekendColor} ${colW * 6}px)`,
    ].join(", "),
    backgroundSize: `${colW}px 100%, ${colW * 7}px 100%`,
    backgroundPosition: `0 0, ${-weekdayOf(minDay) * colW}px 0`,
    backgroundRepeat: "repeat-x",
  };

  // --- Zoom (keeps the centre of the view where it is) ---
  const changeZoom = (next: Zoom) => {
    if (next === zoom) return;
    const el = scrollRef.current;
    if (el) zoomAnchor.current = minDay + (el.scrollLeft + (el.clientWidth - labelW) / 2) / colW;
    setZoom(next);
  };
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (zoomAnchor.current === null || !el) return;
    el.scrollLeft = Math.max(0, (zoomAnchor.current - minDay) * colW - (el.clientWidth - labelW) / 2);
    zoomAnchor.current = null;
    measure();
  }, [colW, minDay, labelW, measure]);

  // --- Jump to a date (today / project start / project end) ---
  const today = dayNumber(todayStr()) ?? 0;
  const todayInRange = today >= bounds.min - 2 && today <= bounds.max + 5;
  useLayoutEffect(() => {
    if (jumpTo === null) return;
    if (jumpTo < minDay || jumpTo > maxDay) {
      // the chosen date is outside the current focus area: show the whole project first
      if (filterScope !== "all") setFilterScope("all");
      else setJumpTo(null);
      return;
    }
    const el = scrollRef.current;
    if (el) el.scrollTo({ left: Math.max(0, (jumpTo - minDay) * colW - (el.clientWidth - labelW) / 2), behavior: "smooth" });
    setJumpTo(null);
  }, [jumpTo, minDay, maxDay, colW, labelW, filterScope]);

  // --- Keyboard control of a bar: arrows move, +/- change duration, Enter opens details ---
  const focusNeighbour = useCallback((taskId: string, dir: -1 | 1) => {
    const { visibleTasks: list, stageCount } = live.current;
    const idx = list.findIndex((t) => t.id === taskId);
    const target = list[idx + dir];
    const el = scrollRef.current;
    if (!target || !el) return;
    const find = () => el.querySelector<HTMLElement>(`[data-bar="${target.id}"]`);
    const now = find();
    if (now) {
      now.focus();
      return;
    }
    el.scrollTop = HEADER_H + (stageCount + idx + dir) * ROW_H - el.clientHeight / 2;
    requestAnimationFrame(() => requestAnimationFrame(() => find()?.focus()));
  }, []);

  const handleBarKey = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>, task: Task) => {
      const { tasks: all, onUpdateTasks: update } = live.current;
      const apply = (next: Task[]) => {
        e.preventDefault();
        update(next, true);
      };
      const startDay = dayNumber(task.calcStart);
      switch (e.key) {
        case "ArrowLeft":
        case "ArrowRight": {
          if (startDay === null) return;
          const delta = (e.key === "ArrowLeft" ? -1 : 1) * (e.shiftKey ? 7 : 1);
          apply(applyMove(all.map(stripCalculated), task.id, dayToStr(startDay + delta), delta));
          return;
        }
        case "+":
        case "=":
          apply(applyResize(all.map(stripCalculated), task.id, task.duration + 1));
          return;
        case "-":
        case "_":
          if (task.duration > 1) apply(applyResize(all.map(stripCalculated), task.id, task.duration - 1));
          return;
        case "Enter":
        case " ":
          e.preventDefault();
          setDetailTask(task);
          return;
        case "ArrowUp":
        case "ArrowDown":
          e.preventDefault();
          focusNeighbour(task.id, e.key === "ArrowUp" ? -1 : 1);
          return;
      }
    },
    [focusNeighbour]
  );

  // --- PDF export (whole project or one stage, vector) ---
  const pdfInput: PdfInput = {
    tasks,
    trades,
    stages,
    cal,
    weatherRanges: cal.weatherRanges,
    baseline,
    projectInfo,
    today: dayNumber(todayStr()) ?? 0,
    printedAt: new Date(),
  };
  const handlePdf = async (opts: PdfOptions) => {
    setPdfBusy(true);
    setPdfError(null);
    try {
      const { blob } = await buildPdf({ ...pdfInput, printedAt: new Date() }, opts);
      const stage = opts.scope === "all" ? "" : `_${stages.find((s) => s.id === opts.scope)?.name ?? "etape"}`;
      const name = `${projectInfo?.projectName || "Tidsplan"}${stage}_Gantt`.trim().replace(/[^a-zA-Z0-9æøåÆØÅ\s-_]/g, "").replace(/\s+/g, "_");
      downloadBlob(blob, `${name}.pdf`);
      setPdfOpen(false);
    } catch (e) {
      setPdfError(`PDF'en kunne ikke laves: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setPdfBusy(false);
    }
  };

  // --- Export ---
  const handleExport = () => {
    let scopeLabel = "Hele projektet";
    if (filterScope === "stage") {
      const stage = stageById.get(selectedStageId);
      scopeLabel = stage ? `Etape: ${stage.name}` : "Valgt Etape";
    } else if (filterScope === "month" && selectedMonthStr) {
      const found = availableMonths.find((m) => m.val === selectedMonthStr);
      scopeLabel = found ? `Måned: ${found.label}` : selectedMonthStr;
    } else if (filterScope === "year") {
      scopeLabel = `År: ${selectedYearVal}`;
    }
    exportFullGantt({ allTasks: tasks, tasks: visibleTasks, stages: visibleStages, trades, cal, minDay, maxDay, scopeLabel });
  };

  if (scheduled.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center bg-white rounded-xl shadow-xs border border-slate-100">
        <Calendar className="w-12 h-12 text-slate-300 mb-3" />
        <h3 className="text-base font-semibold text-slate-700">Tidsplanen er tom</h3>
        <p className="text-slate-500 text-sm max-w-sm mt-1">
          Tryk på <strong>Opret ny opgave</strong> for at se Gantt-diagrammet her.
        </p>
      </div>
    );
  }

  const firstCol = Math.min(win.firstCol, Math.max(0, days - 1));
  const lastCol = Math.min(win.lastCol, days - 1);
  const firstRow = Math.min(win.firstRow, Math.max(0, rowCount - 1));
  const lastRow = Math.min(win.lastRow, rowCount - 1);

  const compact = zoom !== "day";
  const headerCells: React.ReactNode[] = [];
  for (let idx = firstCol; idx <= lastCol; idx++) {
    const day = minDay + idx;
    const date = new Date(day * 86_400_000); // UTC-based, read with getUTC*
    const dateStr = dayToStr(day);
    const isWe = isWeekendDay(day);
    const isHol = cal.isHoliday(day);
    const holidayName = cal.holidays.get(day);
    const isWeather = cal.isWeatherDay(day);
    const foundWeather = isWeather ? weatherDelays.find((wd) => dateStr >= wd.startDate && dateStr <= wd.endDate) : undefined;
    const tip = `${dayTitleFmt.format(date)}${isHol && holidayName ? `\nLukkedag: ${holidayName}` : ""}${
      foundWeather ? `\nUvejr/Arbejdsstop: ${foundWeather.label}` : ""
    }\n\nKlik for at tilføje/fjerne helligdag eller uvejr!`;

    if (compact) {
      headerCells.push(
        <div
          key={day}
          onClick={() => setSelectedDay(dateStr)}
          title={tip}
          style={{ width: `${colW}px` }}
          className={`relative shrink-0 h-full cursor-pointer hover:brightness-90 ${colW >= 24 ? "border-r border-slate-250" : ""} ${
            isHol ? "bg-purple-200" : isWeather ? "bg-sky-200" : isWe ? "bg-emerald-100" : "bg-slate-50"
          }`}
        >
          {zoom === "week" && weekdayOf(day) === 1 && (
            <span className="absolute bottom-1 left-0.5 text-[9px] font-black text-slate-600 select-none">{date.getUTCDate()}</span>
          )}
        </div>
      );
      continue;
    }

    headerCells.push(
      <div
        key={day}
        onClick={() => setSelectedDay(dateStr)}
        title={tip}
        style={{ width: `${colW}px` }}
        className={`relative shrink-0 h-full border-r border-slate-250 text-center flex flex-col items-center justify-center py-2 cursor-pointer transition hover:bg-slate-200 hover:brightness-105 active:scale-95 ${
          isHol ? "bg-purple-100/95 font-extrabold text-purple-950" : isWeather ? "bg-sky-100/95 font-extrabold text-sky-950" : isWe ? "bg-emerald-50/70" : "bg-slate-50"
        }`}
      >
        {isHol && <div className="absolute top-0 inset-x-0 h-1 bg-purple-500" />}
        {isWeather && <div className="absolute top-0 inset-x-0 h-1 bg-sky-500" />}
        {isWe && !isHol && !isWeather && <div className="absolute top-0 inset-x-0 h-1 bg-emerald-400" />}

        <span className="text-[8.5px] uppercase font-black text-slate-400 select-none">{MONTHS_SHORT[date.getUTCMonth()]}</span>
        <div className="flex items-center gap-0.5 mt-0.5 select-none font-black">
          <span className={`text-[12px] font-black ${isWe || isHol || isWeather ? "text-slate-900" : "text-slate-800"}`}>
            {date.getUTCDate()}
          </span>
          {isHol && <span className="text-[10px]" title={holidayName || "Lukkedag"}>🇩🇰</span>}
          {isWeather && <span className="text-[10px]" title={foundWeather?.label}>❄️</span>}
        </div>
      </div>
    );
  }

  // Month labels for the compact zoom levels (the day cells are too narrow to carry text)
  const monthLabels: React.ReactNode[] = [];
  if (compact && days > 0) {
    const first = new Date((minDay + firstCol) * 86_400_000);
    let y = first.getUTCFullYear();
    let m = first.getUTCMonth();
    for (;;) {
      const startDay = Math.floor(Date.UTC(y, m, 1) / 86_400_000);
      if (startDay > minDay + lastCol) break;
      const left = (Math.max(startDay, minDay) - minDay) * colW;
      monthLabels.push(
        <div key={`${y}-${m}`} style={{ left }} className="absolute top-0 h-full pointer-events-none">
          {startDay >= minDay && <div className="absolute inset-y-0 left-0 w-px bg-slate-400/60" />}
          <span className="absolute top-1 left-1 text-[10px] font-black uppercase text-slate-600 whitespace-nowrap select-none">
            {MONTHS_SHORT[m]} {y}
          </span>
        </div>
      );
      if (++m > 11) {
        m = 0;
        y++;
      }
    }
  }

  const todayX = today >= minDay && today <= maxDay ? (today - minDay) * colW + colW / 2 : null;

  const rows: React.ReactNode[] = [];
  for (let r = firstRow; r <= lastRow; r++) {
    const top = r * ROW_H;
    if (r < visibleStages.length) {
      const stage = visibleStages[r];
      rows.push(
        <GanttStageRow
          key={`s-${stage.id}`}
          stage={stage}
          collapsed={collapsedStages.has(stage.id)}
          taskCount={stageTaskCount.get(stage.id) ?? 0}
          onToggle={toggleStage}
          top={top}
          totalWidth={totalWidth}
          timelineWidth={timelineWidth}
          columnCollapsed={columnCollapsed}
          colW={colW}
          minDay={minDay}
          maxDay={maxDay}
        />
      );
    } else {
      const task = visibleTasks[r - visibleStages.length];
      rows.push(
        <GanttTaskRow
          key={task.id}
          task={task}
          number={taskNumber.get(task.id) ?? 0}
          top={top}
          totalWidth={totalWidth}
          timelineWidth={timelineWidth}
          columnCollapsed={columnCollapsed}
          colW={colW}
          minDay={minDay}
          maxDay={maxDay}
          cal={cal}
          tradeById={tradeById}
          stageById={stageById}
          isDragging={draggingId === task.id}
          base={showBaseline ? baseSpans.get(task.id) : undefined}
          deviation={showBaseline ? endDeviationDays(task, baseTasks.get(task.id)) : null}
          onOpenDetail={openDetail}
          onExpandColumn={expandColumn}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onBarKeyDown={handleBarKey}
        />
      );
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Visningsfilter og Printstyring Kontrolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-1.5 text-xs font-black text-slate-700">
            <SlidersHorizontal className="w-4 h-4 text-sky-500 shrink-0" />
            <span>Fokusområde:</span>
          </div>
          
          <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200">
            <button
              type="button"
              onClick={() => setFilterScope("all")}
              className={`px-3 py-1.5 text-xs font-extrabold rounded-md transition ${
                filterScope === "all" ? "bg-white text-sky-700 shadow-xs" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Hele projektet
            </button>
            <button
              type="button"
              onClick={() => setFilterScope("stage")}
              className={`px-3 py-1.5 text-xs font-extrabold rounded-md transition ${
                filterScope === "stage" ? "bg-white text-sky-700 shadow-xs" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Etape
            </button>
            <button
              type="button"
              onClick={() => setFilterScope("month")}
              className={`px-3 py-1.5 text-xs font-extrabold rounded-md transition ${
                filterScope === "month" ? "bg-white text-sky-700 shadow-xs" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Måned
            </button>
            <button
              type="button"
              onClick={() => setFilterScope("year")}
              className={`px-3 py-1.5 text-xs font-extrabold rounded-md transition ${
                filterScope === "year" ? "bg-white text-sky-700 shadow-xs" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              År
            </button>
          </div>

          {/* Conditional Sub-selectors based on focusing choice */}
          {filterScope === "stage" && stages && stages.length > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wide">Etape:</span>
              <select
                value={selectedStageId}
                onChange={(e) => setSelectedStageId(e.target.value)}
                className="p-1.5 px-3 rounded-lg border border-slate-200 text-xs font-black bg-slate-50 hover:bg-slate-100 text-slate-705 cursor-pointer focus:outline-sky-500 transition-all shadow-2xs"
              >
                {stages.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {filterScope === "month" && availableMonths.length > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wide">Måned:</span>
              <select
                value={selectedMonthStr}
                onChange={(e) => setSelectedMonthStr(e.target.value)}
                className="p-1.5 px-3 rounded-lg border border-slate-200 text-xs font-black bg-slate-50 hover:bg-slate-100 text-slate-705 cursor-pointer focus:outline-sky-500 transition-all shadow-2xs"
              >
                {availableMonths.map((m) => (
                  <option key={m.val} value={m.val}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {filterScope === "year" && availableYears.length > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wide">År:</span>
              <select
                value={selectedYearVal}
                onChange={(e) => setSelectedYearVal(Number(e.target.value))}
                className="p-1.5 px-3 rounded-lg border border-slate-200 text-xs font-black bg-slate-50 hover:bg-slate-100 text-slate-705 cursor-pointer focus:outline-sky-500 transition-all shadow-2xs"
              >
                {availableYears.map((yr) => (
                  <option key={yr} value={yr}>
                    {yr}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <button
          onClick={handleExport}
          className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white font-extrabold text-xs rounded-xl shadow-sm border-0 transition active:scale-95 flex items-center gap-2 cursor-pointer transition-all"
        >
          <FolderDown className="w-4 h-4" />
          <span>Hent som HTML</span>
        </button>
        <button
          onClick={() => setPdfOpen(true)}
          data-testid="open-pdf"
          className="px-4 py-2 bg-slate-900 hover:bg-black text-white font-extrabold text-xs rounded-xl shadow-sm border-0 transition active:scale-95 flex items-center gap-2 cursor-pointer"
        >
          <FileText className="w-4 h-4" />
          <span>Gem som PDF…</span>
        </button>
      </div>

      {/* View toolbar: zoom, jump buttons, dependency arrows */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 bg-sky-50/50 p-2.5 px-4 rounded-xl border border-sky-100/70 shadow-2xs">
        <div className="flex items-center gap-2" role="group" aria-label="Zoom">
          <ZoomIn className="w-4 h-4 text-sky-600 shrink-0" />
          <div className="flex bg-white p-0.5 rounded-lg border border-slate-200">
            {([["day", "Dag"], ["week", "Uge"], ["month", "Måned"]] as [Zoom, string][]).map(([z, label]) => (
              <button
                key={z}
                type="button"
                aria-pressed={zoom === z}
                onClick={() => changeZoom(z)}
                className={`px-2.5 py-1 text-[11px] font-extrabold rounded-md transition cursor-pointer ${
                  zoom === z ? "bg-sky-600 text-white shadow-xs" : "text-slate-500 hover:text-slate-800"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-1.5" role="group" aria-label="Spring til">
          <button
            type="button"
            onClick={() => setJumpTo(today)}
            disabled={!todayInRange}
            title={todayInRange ? "Gå til dags dato" : "I dag ligger uden for tidsplanen"}
            className="px-2.5 py-1 text-[11px] font-extrabold rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 cursor-pointer disabled:opacity-40 disabled:cursor-default"
          >
            I dag
          </button>
          <button
            type="button"
            onClick={() => setJumpTo(bounds.min)}
            className="px-2.5 py-1 text-[11px] font-extrabold rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 cursor-pointer"
          >
            Projektstart
          </button>
          <button
            type="button"
            onClick={() => setJumpTo(bounds.max)}
            className="px-2.5 py-1 text-[11px] font-extrabold rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 cursor-pointer"
          >
            Projektslut
          </button>
        </div>

        {visibleStages.length > 0 && (
          <div className="flex items-center gap-1.5" role="group" aria-label="Etaper">
            <button
              type="button"
              data-testid="collapse-all"
              onClick={() => setCollapsedStages(new Set(stages.map((s) => s.id)))}
              className="px-2.5 py-1 text-[11px] font-extrabold rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 cursor-pointer"
            >
              Fold etaper sammen
            </button>
            <button
              type="button"
              data-testid="expand-all"
              onClick={() => setCollapsedStages(new Set())}
              disabled={collapsedStages.size === 0}
              className="px-2.5 py-1 text-[11px] font-extrabold rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 cursor-pointer disabled:opacity-40 disabled:cursor-default"
            >
              Fold alle ud
            </button>
          </div>
        )}

        <label className="flex items-center gap-1.5 text-[11px] font-extrabold text-slate-600 cursor-pointer">
          <input type="checkbox" checked={showArrows} onChange={(e) => setShowArrows(e.target.checked)} className="accent-sky-600" />
          <Link2 className="w-3.5 h-3.5 text-slate-500" />
          <span>Vis afhængigheder</span>
        </label>

        <div className="flex items-center gap-2 flex-wrap" role="group" aria-label="Baseline">
          <button
            type="button"
            onClick={onSaveBaseline}
            title="Gem den nuværende plan som baseline, så du senere kan se afvigelser"
            className="px-2.5 py-1 text-[11px] font-extrabold rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 cursor-pointer"
          >
            {baseline ? "Opdatér baseline" : "Gem baseline"}
          </button>
          {baseline && (
            <>
              <label className="flex items-center gap-1.5 text-[11px] font-extrabold text-slate-600 cursor-pointer">
                <input type="checkbox" checked={showBaseline} onChange={(e) => setShowBaseline(e.target.checked)} className="accent-sky-600" />
                <span>Vis baseline ({new Date(baseline.savedAt).toLocaleDateString("da-DK")})</span>
              </label>
              <button type="button" onClick={onClearBaseline} className="text-[11px] font-extrabold text-red-600 hover:underline cursor-pointer">
                Fjern
              </button>
            </>
          )}
        </div>

        <div className="flex items-center gap-2 text-[11px] font-semibold text-sky-700/80 leading-tight min-w-0">
          <Zap className="w-4 h-4 text-sky-500 shrink-0" />
          <span>
            Træk bjælker med musen, eller vælg en bjælke (Tab) og brug piletaster, + / − og Enter.
          </span>
        </div>
      </div>

      {/* Main Gantt scroll wrapper (scrolls in both directions; only nearby rows/columns are rendered) */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        style={{ maxHeight: "72vh" }}
        className="w-full overflow-auto border border-slate-200 rounded-xl bg-slate-50 shadow-xs relative"
      >
        <div style={{ width: `${totalWidth}px` }} className="flex flex-col select-none bg-white relative">
          {/* Header row */}
          <div style={{ height: HEADER_H }} className="flex border-b border-slate-200 bg-slate-100 sticky top-0 z-30">
            {columnCollapsed ? (
              <div className="w-11 shrink-0 sticky left-0 z-40 bg-slate-100 border-r border-slate-250 text-slate-650 p-1 flex items-center justify-center shadow-xs">
                <button
                  onClick={() => setColumnCollapsed(false)}
                  className="p-1 text-slate-500 hover:text-slate-800 rounded hover:bg-slate-200 transition cursor-pointer"
                  title="Vis opgavekolonne"
                >
                  <ChevronRight className="w-4 h-4 shrink-0" />
                </button>
              </div>
            ) : (
              <div className="w-52 shrink-0 sticky left-0 z-40 bg-slate-100 border-r border-slate-250 text-slate-800 px-3.5 py-3 text-xs font-black uppercase tracking-wider flex items-center justify-between shadow-xs">
                <span>Opgave</span>
                <button
                  onClick={() => setColumnCollapsed(true)}
                  className="p-1 text-slate-500 hover:text-slate-800 rounded hover:bg-slate-200 transition cursor-pointer"
                  title="Skjul opgavekolonne"
                >
                  <ChevronLeft className="w-4 h-4 shrink-0" />
                </button>
              </div>
            )}

            <div style={{ width: timelineWidth }} className="shrink-0 bg-slate-50 overflow-hidden relative">
              <div className={`flex h-full ${compact ? "pt-5" : ""}`} style={{ marginLeft: firstCol * colW }}>
                {headerCells}
              </div>
              {compact && <div className="absolute inset-0 pointer-events-none">{monthLabels}</div>}
              {todayX !== null && (
                <div
                  style={{ left: todayX - 4 }}
                  className="absolute bottom-0 w-2 h-2 bg-rose-500 rotate-45 pointer-events-none"
                  title="I dag"
                />
              )}
            </div>
          </div>

          {/* Body: one shared background layer + absolutely positioned visible rows */}
          <div style={{ height: rowCount * ROW_H }} className="relative">
            <div style={{ left: labelW, width: timelineWidth, ...gridBackground }} className="absolute inset-y-0 pointer-events-none">
              {overlays.holidayCols.map((col) => (
                <div
                  key={`h${col}`}
                  style={{ left: col * colW, width: colW }}
                  className="absolute inset-y-0 bg-purple-50/90 border-l border-l-purple-200/40"
                />
              ))}
              {overlays.weather.map((w) => (
                <div key={`w${w.left}`} style={{ left: w.left, width: w.width }} className="absolute inset-y-0 bg-sky-100/40" />
              ))}
            </div>
            {showArrows && arrows.length > 0 && (
              <svg
                data-testid="dependency-arrows"
                style={{ left: labelW, top: 0, width: timelineWidth, height: rowCount * ROW_H }}
                className="absolute pointer-events-none z-[5] overflow-hidden"
                aria-hidden="true"
              >
                {arrows
                  .filter((a) => a.hi >= firstRow && a.lo <= lastRow && a.xHi >= firstCol * colW && a.xLo <= (lastCol + 1) * colW)
                  .map((a) => (
                    <g key={a.key} stroke={a.critical ? "#ef4444" : "#94a3b8"} fill="none" strokeWidth="1.5">
                      <path d={a.d} strokeDasharray={a.dashed ? "4 3" : undefined} />
                      <polygon points={a.head} fill={a.critical ? "#ef4444" : "#94a3b8"} stroke="none" />
                    </g>
                  ))}
              </svg>
            )}
            {rows}
            {todayX !== null && (
              <div
                data-testid="today-line"
                style={{ left: labelW + todayX - 1, width: 2 }}
                className="absolute inset-y-0 bg-rose-500/70 pointer-events-none z-[15]"
              />
            )}
          </div>
        </div>
      </div>

      {/* Visual Color Codes Footer Legend */}
      <div className="flex flex-wrap gap-x-5 gap-y-2.5 text-[11px] font-bold text-slate-500 mt-2 p-3 bg-slate-50 rounded-lg border border-slate-200/55 select-none md:items-center">
        <div className="flex items-center gap-1.5">
          <span className="w-3.5 h-3.5 rounded bg-amber-500/10 border border-amber-300 flex items-center justify-center text-[9px] shrink-0">💡</span>
          <span>Tip: Træk bjælken for at rykke startdato. Træk i højre kant for at forlænge varigheden.</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-0.5 h-3.5 bg-rose-500 shrink-0" />
          <span>I dag</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-slate-400 font-black leading-none shrink-0">⤷</span>
          <span>Afhængighed (pil fra forgænger til opgave)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-emerald-50 border border-emerald-100 shrink-0" />
          <span>Weekend (lør-søn)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-purple-100 border border-purple-200 shrink-0" />
          <span>Helligdag</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3.5 h-3.5 bg-sky-100 border border-sky-200/60 rounded flex items-center justify-center text-[8px] tracking-none shrink-0">❄️</span>
          <span>Vejrspildsdag (Arbejdsstop)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rotate-45 bg-amber-500 border border-white shadow-2xs shrink-0" />
          <span>Milepæl (Vigtigt kontrolpunkt)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-5 h-3.5 bg-slate-400 border border-slate-500 relative rounded overflow-hidden shrink-0">
            <div className="absolute inset-y-0 left-0 w-1/2 bg-black/25" />
          </div>
          <span>Færdiggørelsesgrad (mørk skygge)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3.5 h-3.5 rounded border border-red-200 bg-red-50 flex items-center justify-center shadow-3xs text-red-500 shrink-0">
            <Flame className="w-2.5 h-2.5 text-red-500 fill-red-500" />
          </span>
          <span className="font-extrabold text-red-650">Kritisk Vej (Forsinkelse her skubber hele projektets slutdato)</span>
        </div>
      </div>

      {pdfOpen && (
        <PdfExportDialog
          input={pdfInput}
          hasBaseline={!!baseline}
          busy={pdfBusy}
          error={pdfError}
          onExport={handlePdf}
          onClose={() => setPdfOpen(false)}
        />
      )}

      {selectedDay && (
        <DayActionModal
          key={selectedDay}
          date={selectedDay}
          holidays={holidays}
          weatherDelays={weatherDelays}
          onAddHoliday={onAddHoliday}
          onDeleteHoliday={onDeleteHoliday}
          onAddWeatherDelay={onAddWeatherDelay}
          onDeleteWeatherDelay={onDeleteWeatherDelay}
          onClose={() => setSelectedDay(null)}
        />
      )}

      {detailTask && (
        <TaskDetailModal task={detailTask} tradeById={tradeById} onEdit={onEditTask} onClose={() => setDetailTask(null)} />
      )}
    </div>
  );
}
