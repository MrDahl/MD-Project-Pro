import type { Task, Trade, Stage } from "../../types";
import { dayNumber, isWeekendDay, type Calendar } from "../../utils/scheduler";
import { getTaskSegments } from "./model";

export interface ExportContext {
  /** All tasks (used for numbering and the total price). */
  allTasks: Task[];
  /** Tasks and stages overlapping the visible range, in display order. */
  tasks: Task[];
  stages: Stage[];
  trades: Trade[];
  cal: Calendar;
  minDay: number;
  maxDay: number;
  scopeLabel: string;
}

const esc = (s: string) => s.replace(/[&<>'"]/g, "");

/** Builds a standalone HTML/SVG document of the visible timeline and downloads it. */
export function exportFullGantt(ctx: ExportContext): void {
  const { allTasks, trades, cal, minDay, maxDay, scopeLabel } = ctx;
  const activeTasks = ctx.tasks;
  const activeStages = ctx.stages;
  const tradeById = new Map(trades.map((t) => [t.id, t] as const));
  const taskNumber = new Map<string, number>();
  allTasks.forEach((t, i) => {
    if (!taskNumber.has(t.id)) taskNumber.set(t.id, i + 1);
  });

  const totalCostStr = allTasks.reduce((sum, t) => sum + (t.calcCost || 0), 0).toLocaleString("da-DK") + " kr.";

  // One local-noon Date per visible day (only needed for weekday/day labels)
  const activeDates: Date[] = [];
  for (let day = minDay; day <= maxDay; day++) {
    const u = new Date(day * 86_400_000);
    activeDates.push(new Date(u.getUTCFullYear(), u.getUTCMonth(), u.getUTCDate(), 12));
  }
  const inView = (day: number | null) => (day !== null && day >= minDay && day <= maxDay ? day - minDay : -1);

  // Dimensions
  const labelWidth = 180;
  const colWidth = 44;
  const rowHeight = 36;
  const headerHeight = 60;
  const dateColCount = activeDates.length;
  const totalSvgWidth = labelWidth + dateColCount * colWidth + 40;
  const totalSvgHeight = headerHeight + (activeStages.length + activeTasks.length) * rowHeight + 80;

  let gridColsMarkup = "";
  let gridDatesMarkup = "";

  activeDates.forEach((date, idx) => {
    const day = minDay + idx;
    const isWe = isWeekendDay(day);
    const isHol = cal.isHoliday(day);
    const isWeather = cal.isWeatherDay(day);
    const colX = labelWidth + idx * colWidth;

    const fillColor = isHol ? "#f3e8ff" : isWeather ? "#e0f2fe" : isWe ? "#ecfdf5" : "#ffffff";
    const opacityVal = isHol ? "0.85" : isWeather ? "0.85" : isWe ? "0.6" : "0.15";

    gridColsMarkup += `
        <rect x="${colX}" y="0" width="${colWidth}" height="${totalSvgHeight - 80}" fill="${fillColor}" opacity="${opacityVal}" stroke="#e2e8f0" stroke-width="0.5" />
      `;

    const dayName = date.toLocaleDateString("da-DK", { weekday: "short" }).substring(0, 2);
    const dayNum = date.getDate();

    let indicatorMarkup = "";
    if (isHol) {
      indicatorMarkup = `<text text-anchor="middle" font-size="8" y="24" fill="#a855f7">🇩🇰</text>`;
    } else if (isWeather) {
      indicatorMarkup = `<text text-anchor="middle" font-size="8" y="24" fill="#0ea5e9">❄️</text>`;
    }

    gridDatesMarkup += `
        <g transform="translate(${colX + colWidth / 2}, 25)">
          <text text-anchor="middle" font-size="8.5" font-family="sans-serif" font-weight="950" fill="#64748b">${dayName.toUpperCase()}</text>
          <text text-anchor="middle" font-size="11.5" font-family="sans-serif" font-weight="950" y="12" fill="${isHol ? "#6b21a8" : isWeather ? "#0369a1" : isWe ? "#065f46" : "#0f172a"}">${dayNum}</text>
          ${indicatorMarkup}
        </g>
      `;
  });

  let rowsMarkup = "";
  let currentY = headerHeight;

  // Stage rows first
  activeStages.forEach((stage) => {
    const sDay = dayNumber(stage.startDate);
    const eDay = dayNumber(stage.endDate);

    rowsMarkup += `
        <line x1="0" y1="${currentY}" x2="${totalSvgWidth}" y2="${currentY}" stroke="#e2e8f0" stroke-width="0.75" />
      `;

    rowsMarkup += `
        <g transform="translate(10, ${currentY + 11})">
          <circle cx="5" cy="5" r="4.5" fill="${stage.color}" />
          <text x="14" y="8" font-size="10.5" font-family="sans-serif" font-weight="950" fill="#1e293b">${esc(stage.name)}</text>
          <text x="14" y="18" font-size="7.5" font-family="sans-serif" font-weight="950" fill="#94a3b8" letter-spacing="0.05em">ETAPE / FASE</text>
        </g>
      `;

    if (sDay !== null && eDay !== null && sDay <= maxDay && eDay >= minDay) {
      const sIdx = inView(sDay);
      const eIdx = inView(eDay);
      const leftIdx = sIdx !== -1 ? sIdx : 0;
      const rightIdx = eIdx !== -1 ? eIdx : activeDates.length - 1;
      const leftPx = labelWidth + leftIdx * colWidth;
      const widthPx = (rightIdx - leftIdx + 1) * colWidth;

      rowsMarkup += `
          <rect x="${leftPx}" y="${currentY + 5}" width="${widthPx}" height="${rowHeight - 10}" fill="${stage.color}15" stroke="${stage.color}40" stroke-width="1.5" stroke-dasharray="3,2" rx="4" />
          <text x="${leftPx + 8}" y="${currentY + 20}" font-size="9.5" font-family="sans-serif" font-weight="900" fill="${stage.color}">${esc(stage.name)}</text>
        `;
    }

    currentY += rowHeight;
  });

  // Task rows
  activeTasks.forEach((task) => {
    const taskNum = taskNumber.get(task.id) ?? 0;
    const textX = 10;
    const textY = currentY + 22;

    rowsMarkup += `
        <line x1="0" y1="${currentY}" x2="${totalSvgWidth}" y2="${currentY}" stroke="#e2e8f0" stroke-width="0.75" />
      `;

    rowsMarkup += `
        <text x="${textX}" y="${textY}" font-size="11" font-family="sans-serif" font-weight="bold" fill="${task.isCritical ? "#dc2626" : "#334155"}">
          ${taskNum}. ${esc(task.title)} ${task.isCritical ? " (🔥)" : ""}
        </text>
      `;

    const segments = getTaskSegments(task, minDay, maxDay, cal);
    const taskEndColumnIndex = inView(dayNumber(task.calcEnd));

    segments.forEach((seg) => {
      const leftPx = labelWidth + seg.startIndex * colWidth;
      const widthPx = (seg.endIndex - seg.startIndex + 1) * colWidth;
      const centerY = currentY + rowHeight / 2;

      if (seg.type === "work") {
        const hexColor = tradeById.get((task.tradeIds || [])[0])?.color || "#475569";
        rowsMarkup += `
            <rect x="${leftPx}" y="${currentY + 6}" width="${widthPx}" height="${rowHeight - 12}" fill="${hexColor}" rx="4" stroke="rgba(0,0,0,0.1)" stroke-width="1" />
          `;
      } else {
        rowsMarkup += `
            <line x1="${leftPx}" y1="${centerY}" x2="${leftPx + widthPx}" y2="${centerY}" stroke="#94a3b8" stroke-width="2" stroke-dasharray="3,3" />
          `;
      }
    });

    if (taskEndColumnIndex >= 0 && taskEndColumnIndex < activeDates.length) {
      const textLabelX = labelWidth + (taskEndColumnIndex + 1) * colWidth + 8;
      const textLabelY = currentY + 22;
      rowsMarkup += `
          <g transform="translate(${textLabelX}, ${textLabelY})">
            <rect x="-4" y="-12" width="${task.title.length * 6 + 50}" height="18" fill="rgba(255,255,255,0.92)" stroke="#e2e8f0" stroke-width="1" rx="4" />
            <text font-size="10" font-family="sans-serif" font-weight="900" fill="#334155">${esc(task.title)} (${task.duration}d)</text>
          </g>
        `;
    }

    currentY += rowHeight;
  });

  rowsMarkup += `
      <line x1="0" y1="${currentY}" x2="${totalSvgWidth}" y2="${currentY}" stroke="#cbd5e1" stroke-width="1" />
    `;

    const svgOutput = `
      <svg width="${totalSvgWidth}" height="${totalSvgHeight}" viewBox="0 0 ${totalSvgWidth} ${totalSvgHeight}" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="#f8fafc" />
        
        <rect width="${totalSvgWidth}" height="${headerHeight}" fill="#f8fafc" />
        
        <rect x="0" y="0" width="${labelWidth}" height="${totalSvgHeight - 80}" fill="#ffffff" stroke="#cbd5e1" stroke-width="0.5" />
        <rect x="0" y="0" width="${labelWidth}" height="${headerHeight}" fill="#f1f5f9" stroke="#cbd5e1" stroke-width="1" />
        <text x="15" y="35" font-size="11" font-family="sans-serif" font-weight="950" fill="#475569" letter-spacing="0.05em">OPGAVE</text>
        
        <line x1="0" y1="${headerHeight}" x2="${totalSvgWidth}" y2="${headerHeight}" stroke="#cbd5e1" stroke-width="1.5" />
        
        ${gridColsMarkup}
        ${gridDatesMarkup}
        ${rowsMarkup}
        
        <g transform="translate(15, ${totalSvgHeight - 65})">
          <rect width="${totalSvgWidth - 30}" height="45" fill="#f1f5f9" stroke="#cbd5e1" stroke-width="1" rx="6" />
          <text x="15" y="26" font-size="11" font-family="sans-serif" font-weight="950" fill="#334155">
            Total Sagspris: ${totalCostStr}  |  Periode: ${scopeLabel}  |  Overenskomstmæssig Tidsplanlægning  |  🔥 Kritisk vej markeret
          </text>
        </g>
      </svg>
    `;

    const htmlOutput = `
      <!DOCTYPE html>
      <html lang="da">
      <head>
        <meta charset="UTF-8">
        <title>Tidsplan - Gantt-diagram (${scopeLabel})</title>
        <style id="print-page-style">
          @page {
            size: landscape;
            margin: 10mm;
          }
        </style>
        <style>
          body {
            margin: 0;
            padding: 24px;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            background-color: #f8fafc;
            color: #1e293b;
          }
          .control-panel {
            background: #ffffff;
            border: 1px solid #e2e8f0;
            border-radius: 12px;
            padding: 18px;
            margin-bottom: 24px;
            box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.05);
          }
          .card {
            background: white;
            padding: 24px;
            border-radius: 16px;
            border: 1px solid #e2e8f0;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
            max-width: 100%;
          }
          .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
          }
          h1 {
            font-size: 22px;
            font-weight: 950;
            margin: 0;
            color: #0f172a;
            letter-spacing: -0.025em;
          }
          .btn {
            background-color: #0284c7;
            color: white;
            border: none;
            padding: 10px 20px;
            font-size: 13px;
            font-weight: 800;
            border-radius: 8px;
            cursor: pointer;
            display: inline-flex;
            align-items: center;
            gap: 6px;
            transition: all 0.1s ease;
          }
          .btn:hover {
            background-color: #0369a1;
            transform: translateY(-1px);
          }
          .svg-container {
            width: 100%;
            max-width: 100%;
            border: 1px solid #cbd5e1;
            border-radius: 12px;
            background: #ffffff;
            overflow-x: auto;
          }
          .svg-container svg {
            display: block;
            width: 100%;
            max-width: 100%;
            height: auto;
          }
          .svg-container.full-size {
            overflow-x: auto;
          }
          .svg-container.full-size svg {
            width: ${totalSvgWidth}px !important;
            max-width: none !important;
          }
          @media print {
            body {
              background: white !important;
              padding: 0 !important;
              margin: 0 !important;
            }
            .control-panel {
              display: none !important;
            }
            .card {
              box-shadow: none !important;
              border: none !important;
              padding: 0 !important;
              margin: 0 !important;
            }
            .no-print {
              display: none !important;
            }
            .svg-container {
              border: none !important;
              border-radius: 0 !important;
              overflow: visible !important;
              width: 100% !important;
              max-width: 100% !important;
            }
            .svg-container svg {
              width: 100% !important;
              max-width: 100% !important;
              height: auto !important;
            }
          }
        </style>
      </head>
      <body>
        <div class="control-panel no-print">
          <div style="font-weight: 900; font-size: 15px; margin-bottom: 6px; color: #0f172a; display: flex; align-items: center; gap: 6px;">
            <span>🛸</span> Print- og dokumentationsindstillinger
          </div>
          <div style="display: flex; flex-wrap: wrap; gap: 20px; align-items: center; margin-top: 10px;">
            
            <div>
              <label style="display: block; font-size: 11px; font-weight: 700; color: #475569; margin-bottom: 4px;">Skalering til print / visning:</label>
              <select id="scaleSelect" onchange="updateScale(this.value)" style="padding: 6px 12px; border-radius: 6px; border: 1px solid #cbd5e1; font-size: 12px; background: white; cursor: pointer; font-weight: 600;">
                <option value="fit" selected>Tilpas til sidebredde (Auto-fit - Anbefales til print)</option>
                <option value="100">Fuld størrelse (100% zoom)</option>
                <option value="80">Kompakt (80% zoom)</option>
                <option value="60">Ekstra Kompakt (60% zoom)</option>
                <option value="50">Mini (50% zoom)</option>
              </select>
            </div>

            <div>
              <label style="display: block; font-size: 11px; font-weight: 700; color: #475569; margin-bottom: 4px;">Papirretning:</label>
              <select id="orientSelect" onchange="updateOrientation(this.value)" style="padding: 6px 12px; border-radius: 6px; border: 1px solid #cbd5e1; font-size: 12px; background: white; cursor: pointer; font-weight: 600;">
                <option value="landscape" selected>Liggende (Landscape - Anbefales)</option>
                <option value="portrait">Stående (Portrait)</option>
              </select>
            </div>

            <div style="flex-grow: 1;"></div>

            <button class="btn" onclick="window.print()">
              <span>🖨️ Udskriv eller Gem som PDF</span>
            </button>
          </div>
          
          <div style="background-color: #f0f9ff; border: 1px solid #bae6fd; border-radius: 8px; padding: 12px 14px; margin-top: 14px; font-size: 11px; color: #0369a1; line-height: 1.5;">
            <strong>💡 Sådan får du det bedste printresultat:</strong>
            <ul style="margin: 4px 0 0 0; padding-left: 20px;">
              <li>Vælg <strong>"Tilpas til sidebredde"</strong> herover for at komprimere tidsplanen, så den kan rummes på én sidebredde.</li>
              <li>I den printerdialog der åbner, skal du sætte Layout/Retning til <strong>Liggende (Landscape)</strong>.</li>
              <li>Husk at slå <strong>"Baggrundsgrafik" (Background graphics)</strong> TIL under "Flere indstillinger" i din browsers print-dialog, så farverne på tidsplanen kommer med på printet!</li>
            </ul>
          </div>
        </div>

        <div class="card">
          <div class="header">
            <div>
              <h1>Tidsplan & Gantt-diagram</h1>
              <p style="font-size:11px; color:#64748b; margin:4px 0 0 0;">Genereret: ${new Date().toLocaleDateString("da-DK")} • Visning: <strong>${scopeLabel}</strong> • MD Project</p>
            </div>
            <button class="btn no-print" onclick="window.print()">
              <span>🖨️ Udskriv</span>
            </button>
          </div>
          <div class="svg-container">
            ${svgOutput}
          </div>
        </div>

        <script>
          function updateScale(val) {
            const container = document.querySelector('.svg-container');
            const svg = document.querySelector('.svg-container svg');
            if (!container || !svg) return;

            if (val === 'fit') {
              container.classList.remove('full-size');
              svg.style.width = '100%';
            } else {
              container.classList.add('full-size');
              const pct = parseInt(val) / 100;
              const targetWidth = Math.round(${totalSvgWidth} * pct);
              svg.style.width = targetWidth + 'px';
            }
          }

          function updateOrientation(val) {
            let styleEl = document.getElementById('print-page-style');
            if (!styleEl) {
              styleEl = document.createElement('style');
              styleEl.id = 'print-page-style';
              document.head.appendChild(styleEl);
            }
            styleEl.innerHTML = '@page { size: ' + val + '; margin: 10mm; }';
          }
        </script>
      </body>
      </html>
    `;

    const blob = new Blob([htmlOutput], { type: "text/html;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.setAttribute("download", `projekt-tidsplan-${scopeLabel.toLowerCase().replace(/[^a-z0-9]/g, "_")}.html`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(link.href), 10_000);
}
