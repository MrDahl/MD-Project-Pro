import React, { memo } from "react";
import type { Task, Trade, Stage } from "../../types";
import { dayNumber, type Calendar } from "../../utils/scheduler";
import { ChevronDown, ChevronRight, Flame, Layers } from "lucide-react";
import { ROW_H, getTaskSegments, multiColorGradient } from "./model";

interface RowBase {
  top: number;
  /** Full scrollable width of a row (label column + all day columns). */
  totalWidth: number;
  /** Width of the day columns only. */
  timelineWidth: number;
  columnCollapsed: boolean;
  /** Width of one day column in px (depends on the zoom level). */
  colW: number;
}

/* ------------------------------------------------------------------ stage row */

interface GanttStageRowProps extends RowBase {
  stage: Stage;
  collapsed: boolean;
  taskCount: number;
  onToggle: (stageId: string) => void;
  minDay: number;
  maxDay: number;
}

export const GanttStageRow = memo(function GanttStageRow({
  stage,
  collapsed,
  taskCount,
  onToggle,
  top,
  totalWidth,
  timelineWidth,
  columnCollapsed,
  colW,
  minDay,
  maxDay,
}: GanttStageRowProps) {
  const s = dayNumber(stage.startDate);
  const e = dayNumber(stage.endDate);
  const showBar = s !== null && e !== null && s <= e && s <= maxDay && e >= minDay;
  const from = showBar ? Math.max(s!, minDay) - minDay : 0;
  const to = showBar ? Math.min(e!, maxDay) - minDay : 0;

  return (
    <div
      style={{ top, height: ROW_H, width: totalWidth }}
      className="absolute left-0 flex border-b border-dashed border-slate-200 bg-slate-50/40 hover:bg-slate-100/30 transition items-center"
    >
      {columnCollapsed ? (
        <div
          className="w-11 shrink-0 border-r border-slate-250 h-full flex items-center justify-center sticky left-0 bg-slate-100/50 z-20 shadow-xs"
          title={stage.name}
        >
          <Layers className="w-3.5 h-3.5" style={{ color: stage.color }} />
        </div>
      ) : (
        <div className="w-52 shrink-0 border-r border-slate-250 p-3 h-full flex flex-col justify-center sticky left-0 bg-slate-100/30 z-20 shadow-xs">
          <div className="flex items-center gap-1.5 min-w-0">
            <button
              type="button"
              data-testid="stage-toggle"
              aria-expanded={!collapsed}
              aria-label={`${collapsed ? "Fold ud" : "Fold sammen"}: ${stage.name}`}
              title={collapsed ? `Vis ${taskCount} opgaver` : "Skjul opgaverne i denne etape"}
              onClick={() => onToggle(stage.id)}
              className="p-0.5 -ml-1 rounded hover:bg-slate-200 text-slate-500 cursor-pointer shrink-0"
            >
              {collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: stage.color }} />
            <span className="text-[11px] font-black uppercase tracking-tight text-slate-800 leading-tight truncate">
              {stage.name}
            </span>
          </div>
          <span className="text-[8px] font-bold text-slate-400 mt-1 pl-4 uppercase tracking-widest leading-none">
            {collapsed ? `${taskCount} opgaver skjult` : "Etape / Fase"}
          </span>
        </div>
      )}

      <div style={{ width: timelineWidth }} className="shrink-0 h-full relative flex items-center">
        {showBar && (
          <div
            style={{
              left: `${from * colW}px`,
              width: `${(to - from + 1) * colW}px`,
              backgroundColor: `${stage.color}15`,
              color: stage.color,
              borderColor: `${stage.color}40`,
            }}
            className="absolute h-9 rounded-lg border-2 border-dashed z-10 flex items-center px-3 select-none overflow-hidden"
          >
            <span className="text-[10px] font-bold tracking-wider uppercase truncate flex items-center gap-1">
              <Layers className="w-3 h-3 shrink-0" />
              <span>{stage.name}</span>
            </span>
          </div>
        )}
      </div>
    </div>
  );
});

/* ------------------------------------------------------------------ task row */

interface GanttTaskRowProps extends RowBase {
  task: Task;
  number: number;
  minDay: number;
  maxDay: number;
  cal: Calendar;
  tradeById: Map<string, Trade>;
  stageById: Map<string, Stage>;
  isDragging: boolean;
  /** Baseline span (day numbers) to show as a thin shadow bar, if any. */
  base?: { start: number; end: number };
  /** Calendar days the end has moved against the baseline (positive = later). */
  deviation?: number | null;
  onOpenDetail: (task: Task) => void;
  onExpandColumn: () => void;
  onPointerDown: (e: React.PointerEvent<HTMLDivElement>, task: Task, type: "move" | "resize-right") => void;
  onPointerMove: (e: React.PointerEvent<HTMLDivElement>) => void;
  onPointerUp: (e: React.PointerEvent<HTMLDivElement>, task: Task) => void;
  onBarKeyDown: (e: React.KeyboardEvent<HTMLDivElement>, task: Task) => void;
}

export const GanttTaskRow = memo(function GanttTaskRow({
  task,
  number,
  top,
  totalWidth,
  timelineWidth,
  columnCollapsed,
  colW,
  minDay,
  maxDay,
  cal,
  tradeById,
  stageById,
  isDragging,
  base,
  deviation,
  onOpenDetail,
  onExpandColumn,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onBarKeyDown,
}: GanttTaskRowProps) {
  const segments = !task.isRecurring && !task.isMilestone ? getTaskSegments(task, minDay, maxDay, cal) : [];
  const lastIdx = segments.length - 1;
  const lastWorkIdx = segments.map((s) => s.type).lastIndexOf("work");
  const firstWorkIdx = segments.findIndex((s) => s.type === "work");
  const barLabel = `${task.title}: ${task.calcStart} til ${task.calcEnd}, ${task.duration} ${task.duration === 1 ? "dag" : "dage"}${task.isCritical ? ", kritisk vej" : ""}`;

  const endDay = dayNumber(task.calcEnd);
  const endCol = endDay !== null && endDay >= minDay && endDay <= maxDay ? endDay - minDay : -1;

  const stage = task.stageId ? stageById.get(task.stageId) : undefined;
  const taskProgress = task.progress || 0;

  return (
    <div
      style={{ top, height: ROW_H, width: totalWidth }}
      className="absolute left-0 flex border-b border-slate-150 hover:bg-slate-50/40 transition items-center"
    >
      {/* Left label - opaque & sticky (collapsible) */}
      {columnCollapsed ? (
        <div
          onClick={onExpandColumn}
          className="w-11 shrink-0 border-r border-slate-250 h-full flex items-center justify-center cursor-pointer hover:bg-slate-100 sticky left-0 bg-white z-20 shadow-xs"
          title="Klik for at udvide kolonne"
        >
          <span className="text-[11px] font-black text-slate-600">{number}</span>
        </div>
      ) : (
        <div
          onClick={() => onOpenDetail(task)}
          className="w-52 shrink-0 border-r border-slate-250 p-3 h-full flex flex-col justify-center cursor-pointer hover:bg-slate-50 transition sticky left-0 bg-white z-20 shadow-xs"
          title="Klik for at se opgavedetaljer"
        >
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-xs font-extrabold text-slate-400 shrink-0">{number}.</span>
            <span className={`text-[11px] font-black leading-tight truncate ${task.isCritical ? "text-red-650" : "text-slate-700"}`}>
              {task.title}
            </span>
            {task.isCritical && <Flame className="w-3.5 h-3.5 text-red-500 fill-red-500 shrink-0 inline ml-1" />}
          </div>
          <div className="flex items-center gap-1.5 flex-wrap mt-1">
            <span className="text-[9px] text-slate-400 font-bold truncate leading-none">
              {task.tradeIds && task.tradeIds.length > 0
                ? task.tradeIds
                    .map((tid) => tradeById.get(tid)?.name || "")
                    .filter(Boolean)
                    .join(", ")
                : "Ingen faggrupper"}
            </span>
            {stage && (
              <span
                className="text-[8px] font-black uppercase tracking-wider px-1 py-0.5 rounded border leading-none shrink-0"
                style={{ backgroundColor: `${stage.color}15`, color: stage.color, borderColor: `${stage.color}35` }}
              >
                {stage.name}
              </span>
            )}
            {task.isRecurring && (
              <span className="text-[8px] font-black uppercase tracking-wider px-1 py-0.5 rounded border leading-none shrink-0 bg-blue-50 text-blue-600 border-blue-200">
                Gentagende
              </span>
            )}
          </div>
        </div>
      )}

      {/* Timeline cell with the task's bars */}
      <div style={{ width: timelineWidth }} className="shrink-0 h-full relative flex items-center">
        {segments.map((seg, sIdx) => {
          const leftPx = seg.startIndex * colW;
          const widthPx = (seg.endIndex - seg.startIndex + 1) * colW;

          if (seg.type === "rest") {
            // weekend / holiday inside the task span: thin dashed line
            return (
              <div
                key={sIdx}
                style={{ left: `${leftPx}px`, width: `${widthPx}px` }}
                className="absolute h-9 flex items-center justify-center z-10 pointer-events-none"
                title="Pause (weekend / helligdag)"
              >
                <div className="w-full border-t-2 border-dashed border-slate-350" />
              </div>
            );
          }

          const isFirstSeg = sIdx === 0;
          const isLastSeg = sIdx === lastIdx;

          return (
            <div
              key={sIdx}
              style={{ left: `${leftPx}px`, width: `${widthPx}px`, background: multiColorGradient(task.tradeIds, tradeById) }}
              onPointerDown={(e) => onPointerDown(e, task, "move")}
              onPointerMove={onPointerMove}
              onPointerUp={(e) => onPointerUp(e, task)}
              {...(sIdx === firstWorkIdx
                ? {
                    "data-bar": task.id,
                    tabIndex: 0,
                    role: "button",
                    "aria-label": `${barLabel}. Pil venstre/højre flytter, plus/minus ændrer varighed, Enter åbner detaljer.`,
                    onKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => onBarKeyDown(e, task),
                  }
                : {})}
              className={`absolute h-9 flex items-center justify-between text-white z-10 select-none overflow-hidden outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-1 cursor-grab active:cursor-grabbing border border-black/10 shadow-sm touch-none ${
                isFirstSeg && isLastSeg
                  ? "rounded-lg"
                  : isFirstSeg
                  ? "rounded-l-lg"
                  : isLastSeg
                  ? "rounded-r-lg"
                  : "rounded-none"
              } ${task.isCritical ? "border-2 border-red-500 shadow-md shadow-red-500/10" : ""} ${
                isDragging ? "scale-y-[1.04] brightness-105 ring-2 ring-slate-500/20 shadow-md" : ""
              }`}
            >
              {taskProgress > 0 && <div style={{ width: `${taskProgress}%` }} className="absolute inset-y-0 left-0 bg-black/25 z-0" />}

              {taskProgress > 0 && (
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[9px] font-black text-white/90 z-10 select-none bg-black/15 px-1 rounded">
                  {taskProgress}%
                </span>
              )}

              {/* Resize handle on the last working segment */}
              {sIdx === lastWorkIdx && (
                <div
                  onPointerDown={(e) => onPointerDown(e, task, "resize-right")}
                  onPointerMove={onPointerMove}
                  onPointerUp={(e) => onPointerUp(e, task)}
                  className="absolute right-0 top-0 bottom-0 w-2.5 hover:w-3.5 cursor-ew-resize bg-black/15 hover:bg-black/35 touch-none flex items-center justify-center transition-all rounded-r-lg z-20 group"
                  title="Træk for at forkorte/forlænge varighed (arbejdsdage)"
                >
                  <div className="w-0.5 h-3.5 bg-white/70 group-hover:bg-white rounded" />
                </div>
              )}
            </div>
          );
        })}

        {/* Baseline shadow bar */}
        {base && base.end >= minDay && base.start <= maxDay && (
          <div
            data-testid="baseline-bar"
            style={{
              left: `${(Math.max(base.start, minDay) - minDay) * colW}px`,
              width: `${(Math.min(base.end, maxDay) - Math.max(base.start, minDay) + 1) * colW}px`,
              top: ROW_H - 9,
            }}
            className="absolute h-1.5 rounded bg-slate-400/70 pointer-events-none z-[5]"
            title="Baseline (oprindelig plan)"
          />
        )}

        {/* Milestone diamond */}
        {!task.isRecurring &&
          task.isMilestone &&
          (() => {
            const startDay = dayNumber(task.calcStart);
            if (startDay === null || startDay < minDay || startDay > maxDay) return null;
            const leftPx = (startDay - minDay) * colW + colW / 2 - 10; // centered in the column
            return (
              <div
                style={{ left: `${leftPx}px`, width: "20px", height: "20px" }}
                onClick={() => onOpenDetail(task)}
                className={`absolute rotate-45 z-15 flex items-center justify-center border border-white shadow-md cursor-pointer select-none transition hover:scale-110 active:scale-95 ${
                  task.isCritical ? "bg-red-500 shadow-red-500/30" : "bg-amber-500 shadow-amber-500/30"
                }`}
                title={`${task.title} (Milepæl d. ${task.calcStart})`}
              >
                <div className="-rotate-45 text-[9px] text-white font-black pb-0.5">♦</div>
              </div>
            );
          })()}

        {/* Recurring occurrences */}
        {task.isRecurring &&
          (task.occurrences || []).map((occDate, oIdx) => {
            const day = dayNumber(occDate);
            if (day === null || day < minDay || day > maxDay) return null;
            const colorHex = tradeById.get((task.tradeIds || [])[0])?.color || "#475569";
            const size = Math.min(24, Math.max(8, colW - 2));
            return (
              <div
                key={oIdx}
                style={{
                  left: `${(day - minDay) * colW + (colW - size) / 2}px`,
                  width: `${size}px`,
                  height: `${size}px`,
                  backgroundColor: colorHex,
                  borderColor: `${colorHex}30`,
                }}
                onClick={() => onOpenDetail(task)}
                className="absolute rounded-full flex items-center justify-center text-white z-10 border shadow-xs cursor-pointer select-none active:scale-95 transition-all text-[11px] font-semibold"
                title={`${task.title} - Gentagelse d. ${new Date(`${occDate}T12:00:00`).toLocaleDateString("da-DK")}`}
              >
                {size >= 16 ? "↻" : null}
              </div>
            );
          })}

        {/* Title to the right of the task's end */}
        {endCol >= 0 && (
          <div
            style={{ left: `${(endCol + 1) * colW + 8}px` }}
            className="absolute text-[10px] font-black text-slate-700 whitespace-nowrap z-15 pointer-events-none drop-shadow-xs flex items-center gap-1.5 bg-white/90 border border-slate-200/50 py-1 px-2.5 rounded-full shadow-2xs"
          >
            <span className={`font-black ${task.isCritical ? "text-red-650" : "text-slate-800"}`}>{task.title}</span>
            <span className="text-slate-400 font-bold">({task.duration}d)</span>
            {deviation !== null && deviation !== undefined && deviation !== 0 && (
              <span className={`font-black ${deviation > 0 ? "text-red-600" : "text-emerald-600"}`} title="Afvigelse fra baseline (kalenderdage)">
                {deviation > 0 ? `+${deviation}` : deviation}d
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
});
