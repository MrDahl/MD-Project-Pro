import React, { useState, useRef } from "react";
import { Task, Trade, Stage } from "../types";
import { createSafeDate, toDateStr, isWorkingDay } from "../utils/scheduler";
import { Calendar, Zap, RefreshCw, AlertCircle, ChevronLeft, ChevronRight, FolderDown, Flame, Layers } from "lucide-react";

interface GanttChartProps {
  tasks: Task[];
  trades: Trade[];
  holidays: string[];
  projectStartDate: string;
  stages?: Stage[];
  onUpdateTasks: (updatedTasks: Task[]) => void;
  onEditTask: (task: Task) => void;
}

interface DragState {
  taskId: string;
  type: "move" | "resize-right";
  startX: number;
  startValue: number; // starts working calendar index or duration of task
  originalTasks: Task[];
}

export function GanttChart({
  tasks,
  trades,
  holidays,
  projectStartDate,
  stages = [],
  onUpdateTasks,
  onEditTask,
}: GanttChartProps) {
  const [dragState, setDragState] = useState<DragState | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [columnCollapsed, setColumnCollapsed] = useState(false);

  const exportFullGantt = () => {
    // Collect facts for export
    const totalCostStr = tasks.reduce((sum, t) => sum + (t.calcCost || 0), 0).toLocaleString("da-DK") + " kr.";
    const scheduledTasks = tasks.filter((t) => t.calcStart && t.calcEnd);
    
    // Build columns, grid coordinates
    const labelWidth = 180;
    const colWidth = 44;
    const rowHeight = 36;
    const headerHeight = 60;
    const dateColCount = dateList.length;
    const totalSvgWidth = labelWidth + dateColCount * colWidth + 40;
    const totalSvgHeight = headerHeight + scheduledTasks.length * rowHeight + 80;

    // Generate colors, grid structure, segments to SVG
    let gridColsMarkup = "";
    let gridDatesMarkup = "";
    
    dateList.forEach((date, idx) => {
      const isWe = date.getDay() === 0 || date.getDay() === 6;
      const isHol = holidays.includes(toDateStr(date));
      const colX = labelWidth + idx * colWidth;
      const fillColor = isHol ? "#d8b4fe" : isWe ? "#a7f3d0" : "#ffffff";
      const isWeekendOrHoliday = isWe || isHol;
      const dayName = date.toLocaleDateString("da-DK", { weekday: "short" }).substring(0, 2);
      const dayNum = date.getDate();

      gridColsMarkup += `
        <rect x="${colX}" y="20" width="${colWidth}" height="${totalSvgHeight - 80}" fill="${fillColor}" opacity="${isWeekendOrHoliday ? 0.35 : 0.08}" stroke="#e2e8f0" stroke-width="0.5" />
      `;

      gridDatesMarkup += `
        <g transform="translate(${colX + colWidth / 2}, 35)">
          <text text-anchor="middle" font-size="8" font-family="sans-serif" font-weight="950" fill="#94a3b8" transform="uppercase">${dayName}</text>
          <text text-anchor="middle" font-size="11" font-family="sans-serif" font-weight="950" y="14" fill="${isWeekendOrHoliday ? "#312e81" : "#1e293b"}">${dayNum}</text>
        </g>
      `;
    });

    let rowsMarkup = "";
    scheduledTasks.forEach((task, tIdx) => {
      const taskNum = tIdx + 1;
      const rowY = headerHeight + tIdx * rowHeight;
      const textX = 10;
      const textY = rowY + 22;

      // Draw horizontal separator lines
      rowsMarkup += `
        <line x1="0" y1="${rowY}" x2="${totalSvgWidth}" y2="${rowY}" stroke="#e2e8f0" stroke-width="0.75" />
      `;

      // Draw Sticky/Opaque Task numbers & Titles
      rowsMarkup += `
        <text x="${textX}" y="${textY}" font-size="11" font-family="sans-serif" font-weight="bold" fill="${task.isCritical ? "#dc2626" : "#334155"}">
          ${taskNum}. ${task.title.replace(/[&<>'"]/g, "")} ${task.isCritical ? " (🔥)" : ""}
        </text>
      `;

      // Draw progress or segments
      const segments = getTaskSegments(task);
      const taskEndColumnIndex = task.calcEnd ? dateList.findIndex((d) => toDateStr(d) === task.calcEnd) : -1;

      // Draw segments
      segments.forEach((seg) => {
        const leftPx = labelWidth + seg.startIndex * colWidth;
        const widthPx = (seg.endIndex - seg.startIndex + 1) * colWidth;
        const centerY = rowY + rowHeight / 2;

        if (seg.type === "work") {
          const colors = (task.tradeIds || []).map(tid => trades.find(tr => tr.id === tid)?.color || "#4f46e5");
          const hexColor = colors[0] || "#4f46e5";
          
          rowsMarkup += `
            <rect x="${leftPx}" y="${rowY + 6}" width="${widthPx}" height="${rowHeight - 12}" fill="${hexColor}" rx="4" stroke="rgba(0,0,0,0.1)" stroke-width="1" />
          `;
        } else {
          rowsMarkup += `
            <line x1="${leftPx}" y1="${centerY}" x2="${leftPx + widthPx}" y2="${centerY}" stroke="#94a3b8" stroke-width="2" stroke-dasharray="3,3" />
          `;
        }
      });

      // Task text (always to the right)
      if (taskEndColumnIndex >= 0) {
        const textLabelX = labelWidth + (taskEndColumnIndex + 1) * colWidth + 8;
        const textLabelY = rowY + 22;
        rowsMarkup += `
          <g transform="translate(${textLabelX}, ${textLabelY})">
            <rect x="-4" y="-12" width="${(task.title.length * 6) + 50}" height="18" fill="rgba(255,255,255,0.92)" stroke="#e2e8f0" stroke-width="1" rx="4" />
            <text font-size="10" font-family="sans-serif" font-weight="900" fill="#334155">${task.title.replace(/[&<>'"]/g, "")} (${task.duration}d)</text>
          </g>
        `;
      }
    });

    const svgOutput = `
      <svg width="${totalSvgWidth}" height="${totalSvgHeight}" viewBox="0 0 ${totalSvgWidth} ${totalSvgHeight}" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="#f8fafc" />
        
        <!-- Header background -->
        <rect width="${totalSvgWidth}" height="${headerHeight}" fill="#0f172a" />
        
        <!-- Opgave Sticky column header overlay -->
        <rect x="0" y="20" width="${labelWidth}" height="${totalSvgHeight - 20}" fill="#ffffff" />
        <rect x="0" y="0" width="${labelWidth}" height="${headerHeight}" fill="#0f172a" />
        <text x="15" y="35" font-size="11" font-family="sans-serif" font-weight="black" fill="#ffffff">OPGAVE</text>
        
        <line x1="0" y1="${headerHeight}" x2="${totalSvgWidth}" y2="${headerHeight}" stroke="#cbd5e1" stroke-width="2" />
        
        ${gridColsMarkup}
        ${gridDatesMarkup}
        ${rowsMarkup}
        
        <g transform="translate(15, ${totalSvgHeight - 60})">
          <rect width="${totalSvgWidth - 30}" height="45" fill="#f1f5f9" stroke="#cbd5e1" stroke-width="1" rx="6" />
          <text x="15" y="26" font-size="11" font-family="sans-serif" font-weight="bold" fill="#334155">
            Total Sagspris: ${totalCostStr}  |  Overenskomstmæssig Tidsplanlænding  |  🔥 Kritisk vej markeret
          </text>
        </g>
      </svg>
    `;

    const htmlOutput = `
      <!DOCTYPE html>
      <html lang="da">
      <head>
        <meta charset="UTF-8">
        <title>Tidsplan - Gantt Diagram</title>
        <style>
          body {
            margin: 0;
            padding: 24px;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            background-color: #f1f5f9;
            color: #1e293b;
          }
          .card {
            background: white;
            padding: 24px;
            border-radius: 16px;
            box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
            max-width: 100%;
            overflow-x: auto;
          }
          .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
          }
          h1 {
            font-size: 20px;
            font-weight: 800;
            margin: 0;
            color: #0f172a;
          }
          .btn {
            background-color: #4f46e5;
            color: white;
            border: none;
            padding: 8px 16px;
            font-size: 12px;
            font-weight: 700;
            border-radius: 8px;
            cursor: pointer;
            display: inline-flex;
            align-items: center;
            gap: 6px;
          }
          .btn:hover {
            background-color: #4338ca;
          }
          .svg-container {
            min-width: ${totalSvgWidth}px;
          }
          @print {
            body { background: white; padding: 0; }
            .card { box-shadow: none; padding: 0; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="header">
            <div>
              <h1>Tidsplan & Gantpt diagram</h1>
              <p style="font-size:11px; color:#64748b; margin:4px 0 0 0;">Genereret: ${new Date().toLocaleDateString("da-DK")}</p>
            </div>
            <button class="btn no-print" onclick="window.print()">
              <span>Udskriv / Gem som PDF</span>
            </button>
          </div>
          <div class="svg-container">
            ${svgOutput}
          </div>
        </div>
      </body>
      </html>
    `;

    const blob = new Blob([htmlOutput], { type: "text/html;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.setAttribute("download", `projekt-tidsplan-fuld.html`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const scrollLeftPercent = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: -250, behavior: "smooth" });
    }
  };

  const scrollRightPercent = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: 250, behavior: "smooth" });
    }
  };

  const scrollToStart = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({ left: 0, behavior: "smooth" });
    }
  };

  // Filter tasks that have valid scheduled dates
  const scheduledTasks = tasks.filter((t) => t.calcStart && t.calcEnd);

  if (scheduledTasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center bg-white rounded-xl shadow-xs border border-slate-100">
        <Calendar className="w-12 h-12 text-slate-300 mb-3" />
        <h3 className="text-base font-semibold text-slate-700">Tidsplanen er tom</h3>
        <p className="text-slate-500 text-sm max-w-sm mt-1">
          Opret opgaver i fanen 📋 <strong>Opgaver</strong> og angiv en startdato for at se Gantt-diagrammet her.
        </p>
      </div>
    );
  }

  // Find overall start and end bounds of our timeline view
  let minDateObj = createSafeDate(projectStartDate || "2026-06-01");
  scheduledTasks.forEach((t) => {
    if (t.calcStart) {
      const d = createSafeDate(t.calcStart);
      if (d < minDateObj) minDateObj = d;
    }
  });

  // Start timeline 2 days before the earliest task
  minDateObj.setDate(minDateObj.getDate() - 2);

  let maxDateObj = createSafeDate(projectStartDate || "2026-06-15");
  scheduledTasks.forEach((t) => {
    if (t.calcEnd) {
      const d = createSafeDate(t.calcEnd);
      if (d > maxDateObj) maxDateObj = d;
    }
  });

  // End timeline 5 days after latest task for nice overflow
  maxDateObj.setDate(maxDateObj.getDate() + 5);

  // Generate date range
  const dateList: Date[] = [];
  const startStamp = minDateObj.getTime();
  const endStamp = maxDateObj.getTime();
  const stepMs = 24 * 60 * 60 * 1000;

  for (let currentMs = startStamp; currentMs <= endStamp; currentMs += stepMs) {
    dateList.push(new Date(currentMs));
  }

  const formatHeaderDayNum = (d: Date) => d.getDate();
  const formatHeaderMonth = (d: Date) => {
    const months = ["jan", "feb", "mar", "apr", "maj", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];
    return `${months[d.getMonth()]}`;
  };

  const getMultiColorGradient = (taskTradeIds: string[]) => {
    const validIds = (taskTradeIds || []).filter((id) => trades.some((tr) => tr.id === id));
    if (validIds.length === 0) return "#4f46e5"; // default indigo
    if (validIds.length === 1) {
      const tr = trades.find((x) => x.id === validIds[0]);
      return tr ? tr.color : "#4f46e5";
    }

    const pct = 100 / validIds.length;
    const stops: string[] = [];
    validIds.forEach((id, i) => {
      const tr = trades.find((x) => x.id === id);
      const color = tr ? tr.color : "#4f46e5";
      stops.push(`${color} ${i * pct}%`, `${color} ${(i + 1) * pct}%`);
    });
    return `linear-gradient(90deg, ${stops.join(", ")})`;
  };

  // Helper builder: Split task duration span into consecutive solid work chunks & dotted rest chunks
  const getTaskSegments = (task: Task) => {
    const segments: { startIndex: number; endIndex: number; type: "work" | "rest" }[] = [];
    if (!task.calcStart || !task.calcEnd) return segments;

    const startStamp = createSafeDate(task.calcStart).getTime();
    const endStamp = createSafeDate(task.calcEnd).getTime();

    let currentSegment: { startIndex: number; endIndex: number; type: "work" | "rest" } | null = null;

    dateList.forEach((date, idx) => {
      const stamp = date.getTime();
      if (stamp >= startStamp && stamp <= endStamp) {
        const type = isWorkingDay(date, task.allowWeekend, task.allowHoliday, holidays) ? "work" : "rest";
        if (!currentSegment) {
          currentSegment = { startIndex: idx, endIndex: idx, type };
        } else if (currentSegment.type === type) {
          currentSegment.endIndex = idx;
        } else {
          segments.push(currentSegment);
          currentSegment = { startIndex: idx, endIndex: idx, type };
        }
      }
    });

    if (currentSegment) {
      segments.push(currentSegment);
    }

    return segments;
  };

  // Modern touch/mouse handler
  const handlePointerDown = (
    e: React.PointerEvent<HTMLDivElement>,
    task: Task,
    dragType: "move" | "resize-right"
  ) => {
    e.preventDefault();
    e.stopPropagation();

    // Set pointer capture to track moves outside elements accurately
    e.currentTarget.setPointerCapture(e.pointerId);

    const startX = e.clientX;
    const startValue = dragType === "move"
      ? (task.calcStart ? dateList.findIndex((d) => toDateStr(d) === task.calcStart) : 0)
      : task.duration;

    setDragState({
      taskId: task.id,
      type: dragType,
      startX,
      startValue,
      originalTasks: JSON.parse(JSON.stringify(tasks)), // deep copy to preserve baseline
    });
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragState) return;
    e.preventDefault();
    e.stopPropagation();

    const currentX = e.clientX;
    const dX = currentX - dragState.startX;
    const deltaDays = Math.round(dX / 48); // each daily column is strictly 48px wide

    if (deltaDays === 0) return;

    const task = tasks.find((t) => t.id === dragState.taskId);
    if (!task) return;

    if (dragState.type === "move") {
      const newStartIndex = dragState.startValue + deltaDays;
      const safeIndex = Math.max(0, Math.min(dateList.length - 1, newStartIndex));
      const newStartDateStr = toDateStr(dateList[safeIndex]);

      let updated = dragState.originalTasks.map((t) => {
        if (t.id === task.id) {
          return { ...t, manualStart: newStartDateStr };
        }
        return t;
      });

      // Push successors forward if moved to the right (deltaDays > 0)
      if (deltaDays > 0) {
        const pushSuccessors = (list: Task[], parentId: string, days: number): Task[] => {
          let listCopy = [...list];
          listCopy.forEach((t, i) => {
            if (t.dependencyId === parentId) {
              let nextManualStart = t.manualStart;
              if (nextManualStart) {
                const msDate = createSafeDate(nextManualStart);
                msDate.setDate(msDate.getDate() + days);
                nextManualStart = toDateStr(msDate);
              }
              listCopy[i] = { ...t, manualStart: nextManualStart };
              listCopy = pushSuccessors(listCopy, t.id, days);
            }
          });
          return listCopy;
        };
        updated = pushSuccessors(updated, task.id, deltaDays);
      }

      onUpdateTasks(updated);
    } else if (dragState.type === "resize-right") {
      const newDuration = Math.max(1, dragState.startValue + deltaDays);
      const updated = dragState.originalTasks.map((t) => {
        if (t.id === task.id) {
          return { ...t, duration: newDuration };
        }
        return t;
      });

      onUpdateTasks(updated);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>, task: Task) => {
    if (!dragState) return;
    e.preventDefault();
    e.stopPropagation();

    e.currentTarget.releasePointerCapture(e.pointerId);

    const dX = e.clientX - dragState.startX;
    setDragState(null);

    // Short click triggers editing view, drag shifts schedule
    if (Math.abs(dX) < 3) {
      onEditTask(task);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Dynamic Instruction & Action notice */}
      <div className="flex justify-between items-center bg-slate-50 p-3.5 rounded-xl border border-slate-200 flex-wrap gap-2.5 shadow-2xs">
        <div className="flex items-center gap-2 text-[11px] md:text-xs font-semibold text-slate-500 leading-tight">
          <Zap className="w-4 h-4 text-amber-500 animate-pulse shrink-0" />
          <span>
            <strong>Gestusstyring:</strong> Træk i en farverig bjælke for at <strong>rykke startdatoen</strong>. Træk i højre ende for at <strong>ændre varigheden</strong>. Rul skemaet med bunden.
          </span>
        </div>
        <button
          onClick={exportFullGantt}
          className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-lg shadow-sm border-0 transition active:scale-95 flex items-center gap-1.5 cursor-pointer leading-none"
        >
          <FolderDown className="w-3.5 h-3.5" />
          <span>Hent fuld tidsplan (HTML/PDF)</span>
        </button>
      </div>

      {/* Main Gantt Scroll Wrapper */}
      <div ref={scrollContainerRef} className="w-full overflow-x-auto border border-slate-200 rounded-xl bg-slate-50 shadow-xs relative">
        {/* Table width matches collapsible column + (dagede * 48px) */}
        <div 
          style={{ width: `${(columnCollapsed ? 44 : 208) + dateList.length * 48}px` }} 
          className="flex flex-col select-none bg-white transition-[width] duration-200"
        >
          
          {/* Synchronized Header Row */}
          <div className="flex border-b border-slate-200 bg-slate-100 sticky top-0 z-30 h-14">
            
            {/* Opgave - Collapsible Sticky Left spacer (Light Styled) */}
            {columnCollapsed ? (
              <div className="w-11 shrink-0 sticky left-0 z-40 bg-slate-100 border-r border-slate-250 text-slate-650 p-1 flex items-center justify-center shadow-xs transition-all duration-200">
                <button
                  onClick={() => setColumnCollapsed(false)}
                  className="p-1 text-slate-500 hover:text-slate-800 rounded hover:bg-slate-200 transition cursor-pointer"
                  title="Vis opgavekolonne"
                >
                  <ChevronRight className="w-4 h-4 shrink-0" />
                </button>
              </div>
            ) : (
              <div className="w-52 shrink-0 sticky left-0 z-40 bg-slate-100 border-r border-slate-250 text-slate-800 px-3.5 py-3 text-xs font-black uppercase tracking-wider flex items-center justify-between shadow-xs transition-all duration-200">
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
            
            {/* Timestamps columns */}
            <div className="flex">
              {dateList.map((date, idx) => {
                const isWe = date.getDay() === 0 || date.getDay() === 6;
                const isHol = holidays.includes(toDateStr(date));
                return (
                  <div
                    key={idx}
                    style={{ width: "48px" }}
                    className={`shrink-0 h-full border-r border-slate-200/65 text-center flex flex-col items-center justify-center py-2 ${
                      isHol ? "bg-purple-200/80" : isWe ? "bg-emerald-100/75" : "bg-slate-50"
                    }`}
                  >
                    <span className="text-[8px] uppercase font-black text-slate-400">
                      {formatHeaderMonth(date)}
                    </span>
                    <span className={`text-[11px] font-black mt-0.5 ${isWe || isHol ? "text-indigo-900" : "text-slate-800"}`}>
                      {formatHeaderDayNum(date)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Scheduled Rows */}
          <div className="flex flex-col">
            {/* Render Etaper (Stages) first */}
            {stages && stages.map((stage) => {
              const sIdx = stage.startDate ? dateList.findIndex((d) => toDateStr(d) === stage.startDate) : -1;
              const eIdx = stage.endDate ? dateList.findIndex((d) => toDateStr(d) === stage.endDate) : -1;

              return (
                <div key={stage.id} className="flex border-b border-dashed border-slate-200 bg-indigo-50/5 hover:bg-indigo-50/10 transition h-14 relative items-center">
                  {/* Left Label */}
                  {columnCollapsed ? (
                    <div
                      className="w-11 shrink-0 border-r border-slate-250 h-full flex items-center justify-center sticky left-0 bg-indigo-50/10 z-20 shadow-xs"
                      title={stage.name}
                    >
                      <Layers className="w-3.5 h-3.5" style={{ color: stage.color }} />
                    </div>
                  ) : (
                    <div
                      className="w-52 shrink-0 border-r border-slate-250 p-3 h-full flex flex-col justify-center sticky left-0 bg-indigo-50/20 z-20 shadow-xs"
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: stage.color }} />
                        <span className="text-[11px] font-black uppercase tracking-tight text-slate-800 leading-tight truncate">
                          {stage.name}
                        </span>
                      </div>
                      <span className="text-[8px] font-bold text-slate-400 mt-1 pl-4 uppercase tracking-widest leading-none">
                        Etape / Fase
                      </span>
                    </div>
                  )}

                  {/* Horizontal Cell background and Span */}
                  <div style={{ width: `${dateList.length * 48}px` }} className="shrink-0 h-full relative flex items-center bg-indigo-50/5">
                    {/* Synchronized Base Background Grid columns */}
                    <div className="absolute inset-y-0 left-0 flex">
                      {dateList.map((date, idx) => {
                        const isWe = date.getDay() === 0 || date.getDay() === 6;
                        const isHol = holidays.includes(toDateStr(date));
                        return (
                          <div
                            key={idx}
                            style={{ width: "48px" }}
                            className={`shrink-0 border-r border-slate-100/60 h-full ${
                              isHol ? "bg-purple-200/10" : isWe ? "bg-emerald-100/10" : ""
                            }`}
                          />
                        );
                      })}
                    </div>

                    {/* Stage bar */}
                    {sIdx !== -1 && eIdx !== -1 && sIdx <= eIdx && (
                      <div
                        style={{
                          left: `${sIdx * 48}px`,
                          width: `${(eIdx - sIdx + 1) * 48}px`,
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
            })}

            {scheduledTasks.map((task) => {
              const segments = getTaskSegments(task);
              const maxSIdx = segments.length - 1;
              const lastWorkSegIdx = segments.map((s) => s.type).lastIndexOf("work");

              // Determine overall horizontal span range in days
              const taskStartColumnIndex = task.calcStart ? dateList.findIndex((d) => toDateStr(d) === task.calcStart) : -1;
              const taskEndColumnIndex = task.calcEnd ? dateList.findIndex((d) => toDateStr(d) === task.calcEnd) : -1;

              return (
                <div key={task.id} className="flex border-b border-slate-150 hover:bg-slate-50/40 transition h-14 relative items-center">
                  
                  {/* Left Label - Opaque & Sticky Column (Collapsible) */}
                  {columnCollapsed ? (
                    <div
                      onClick={() => setColumnCollapsed(false)}
                      className="w-11 shrink-0 border-r border-slate-250 h-full flex items-center justify-center cursor-pointer hover:bg-slate-100 sticky left-0 bg-white z-20 shadow-xs transition-all duration-200"
                      title="Klik for at udvide kolonne"
                    >
                      <span className="text-[11px] font-black text-slate-600">
                        {tasks.findIndex((t) => t.id === task.id) + 1}
                      </span>
                    </div>
                  ) : (
                    <div
                      onClick={() => onEditTask(task)}
                      className="w-52 shrink-0 border-r border-slate-250 p-3 h-full flex flex-col justify-center cursor-pointer hover:bg-slate-50 transition sticky left-0 bg-white z-20 shadow-xs transition-all duration-200"
                      title="Klik for at redigere opgave"
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-xs font-extrabold text-slate-400 shrink-0">
                          {tasks.findIndex((t) => t.id === task.id) + 1}.
                        </span>
                        <span className={`text-[11px] font-black leading-tight truncate ${task.isCritical ? "text-red-650" : "text-slate-700"}`}>
                          {task.title}
                        </span>
                        {task.isCritical && <Flame className="w-3.5 h-3.5 text-red-500 fill-red-500 shrink-0 inline ml-1" />}
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap mt-1">
                        <span className="text-[9px] text-slate-400 font-bold truncate leading-none">
                          {task.tradeIds && task.tradeIds.length > 0
                            ? task.tradeIds
                                .map((tid) => trades.find((tr) => tr.id === tid)?.name || "")
                                .filter(Boolean)
                                .join(", ")
                            : "Ingen faggrupper"}
                        </span>
                        {task.stageId && (() => {
                          const s = stages.find((stg) => stg.id === task.stageId);
                          return s ? (
                            <span
                              className="text-[8px] font-black uppercase tracking-wider px-1 py-0.5 rounded border leading-none shrink-0"
                              style={{
                                backgroundColor: `${s.color}15`,
                                color: s.color,
                                borderColor: `${s.color}35`,
                              }}
                            >
                              {s.name}
                            </span>
                          ) : null;
                        })()}
                        {task.isRecurring && (
                          <span className="text-[8px] font-black uppercase tracking-wider px-1 py-0.5 rounded border leading-none shrink-0 bg-blue-50 text-blue-600 border-blue-200">
                            Gentagende
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Horizontal Timeline cells containing the styled segments */}
                  <div style={{ width: `${dateList.length * 48}px` }} className="shrink-0 h-full relative flex items-center">
                    
                     {/* Synchronized Base Background Grid columns */}
                    <div className="absolute inset-y-0 left-0 flex">
                      {dateList.map((date, idx) => {
                        const isWe = date.getDay() === 0 || date.getDay() === 6;
                        const isHol = holidays.includes(toDateStr(date));
                        return (
                          <div
                            key={idx}
                            style={{ width: "48px" }}
                            className={`shrink-0 border-r border-slate-100/60 h-full ${
                              isHol ? "bg-purple-200/15" : isWe ? "bg-emerald-100/20" : "bg-white"
                            }`}
                          />
                        );
                      })}
                    </div>

                    {/* Segment renderings - only if not recurring */}
                    {!task.isRecurring && segments.map((seg, sIdx) => {
                      const leftPx = seg.startIndex * 48;
                      const widthPx = (seg.endIndex - seg.startIndex + 1) * 48;

                      if (seg.type === "work") {
                        const isFirstSeg = sIdx === 0;
                        const isLastSeg = sIdx === maxSIdx;
                        const isLastWorkSegment = sIdx === lastWorkSegIdx;

                        const barStyle: React.CSSProperties = {
                          left: `${leftPx}px`,
                          width: `${widthPx}px`,
                          background: getMultiColorGradient(task.tradeIds),
                        };

                        const isBeingDragged = dragState?.taskId === task.id;

                        return (
                          <div
                            key={sIdx}
                            style={barStyle}
                            onPointerDown={(e) => handlePointerDown(e, task, "move")}
                            onPointerMove={handlePointerMove}
                            onPointerUp={(e) => handlePointerUp(e, task)}
                            className={`absolute h-9 flex items-center justify-between text-white z-10 select-none cursor-grab active:cursor-grabbing border border-black/10 shadow-sm transition-[transform,shadow] ${
                              isFirstSeg && isLastSeg
                                ? "rounded-lg"
                                : isFirstSeg
                                ? "rounded-l-lg"
                                : isLastSeg
                                ? "rounded-r-lg"
                                : "rounded-none"
                            } ${task.isCritical ? "border-2 border-red-500 shadow-md shadow-red-500/10" : ""} ${
                              isBeingDragged ? "scale-y-[1.04] brightness-105 ring-2 ring-indigo-500/20 shadow-md" : ""
                            }`}
                          >
                            {/* Text is always placed directly on the right side of the entire task timeline inside a modern bubble */}

                            {/* Right resize handle on the absolute last working segment of the task */}
                            {isLastWorkSegment && (
                              <div
                                onPointerDown={(e) => handlePointerDown(e, task, "resize-right")}
                                onPointerMove={handlePointerMove}
                                onPointerUp={(e) => handlePointerUp(e, task)}
                                className="absolute right-0 top-0 bottom-0 w-2.5 hover:w-3.5 cursor-ew-resize bg-black/15 hover:bg-black/35 touch-none flex items-center justify-center transition-all rounded-r-lg z-20 group"
                                title="Træk for at forkorte/forlænge varighed (arbejdsdage)"
                              >
                                <div className="w-0.5 h-3.5 bg-white/70 group-hover:bg-white rounded" />
                              </div>
                            )}
                          </div>
                        );
                      } else {
                        // REST / HOLIDAY / WEEKEND segment => draw dynamic thin dashed line across resting columns
                        return (
                          <div
                            key={sIdx}
                            style={{
                              left: `${leftPx}px`,
                              width: `${widthPx}px`,
                            }}
                            className="absolute h-9 flex items-center justify-center z-10 pointer-events-none"
                            title="Pause (weekend / helligdag)"
                          >
                            <div className="w-full border-t-2 border-dashed border-slate-350" />
                          </div>
                        );
                      }
                    })}

                    {/* Recurring Work Occurrences badge renderings */}
                    {task.isRecurring && (task.occurrences || []).map((occDate, oIdx) => {
                      const idx = dateList.findIndex((d) => toDateStr(d) === occDate);
                      if (idx === -1) return null;

                      const leftPx = idx * 48 + 12; // center nicely within the 48px column (48 - 24) / 2 = 12
                      const colors = (task.tradeIds || []).map(tid => trades.find(tr => tr.id === tid)?.color || "#4f46e5");
                      const colorHex = colors[0] || "#4f46e5";

                      return (
                        <div
                          key={oIdx}
                          style={{
                            left: `${leftPx}px`,
                            width: `24px`,
                            height: `24px`,
                            backgroundColor: colorHex,
                            borderColor: `${colorHex}30`,
                          }}
                          onClick={() => onEditTask(task)}
                          className="absolute rounded-full flex items-center justify-center text-white z-10 border shadow-xs cursor-pointer select-none active:scale-95 transition-all text-[11px] font-semibold"
                          title={`${task.title} - Gentagelse d. ${new Date(`${occDate}T12:00:00`).toLocaleDateString("da-DK")}`}
                        >
                          ↻
                        </div>
                      );
                    })}

                    {/* Always place task title to the right side of the task ending point */}
                    {taskEndColumnIndex >= 0 && (
                      <div
                        style={{
                          left: `${(taskEndColumnIndex + 1) * 48 + 8}px`,
                        }}
                        className="absolute text-[10px] font-black text-slate-700 whitespace-nowrap z-15 pointer-events-none drop-shadow-xs flex items-center gap-1.5 bg-white/90 border border-slate-200/50 py-1 px-2.5 rounded-full shadow-2xs"
                      >
                        <span className={`font-black ${task.isCritical ? "text-red-650" : "text-slate-800"}`}>
                          {task.title}
                        </span>
                        <span className="text-slate-400 font-bold">({task.duration}d)</span>
                      </div>
                    )}

                  </div>
                </div>
              );
            })}
          </div>

        </div>
      </div>

      {/* Visual Color Codes Footer Legend */}
      <div className="flex flex-wrap gap-4 text-xs font-semibold text-slate-500 mt-1 select-none">
        <div className="flex items-center gap-1.5">
          <span className="w-3.5 h-3.5 rounded bg-amber-500/10 border border-amber-300 flex items-center justify-center text-[10px]">💡</span>
          <span>Tip: Træk i midten for at rykke, træk i højre kant af sidste blok for at ændre varighed</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-emerald-50 border border-emerald-100" />
          <span>Weekend (lørdag-søndag)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-purple-100 border border-purple-200" />
          <span>Feriedag/helligdag</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3.5 h-0.5 border-t-2 border-dashed border-slate-350" />
          <span>Arbejdspause (stiplet linje)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3.5 h-3.5 rounded border border-red-200 bg-red-50 flex items-center justify-center shadow-2xs text-red-500">
            <Flame className="w-3 h-3 text-red-500 fill-red-500 shrink-0" />
          </span>
          <span className="font-extrabold text-red-650">Kritisk Vej (Forsinkelse her skubber hele deadline)</span>
        </div>
      </div>
    </div>
  );
}
