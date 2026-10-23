import { memo } from "react";
import type { Task, Trade, Stage } from "../types";
import { durationText, clockText } from "../utils/tasks";
import { Copy, Flame, Pencil, Trash2 } from "lucide-react";

interface TaskCardProps {
  task: Task;
  number: number;
  stageById: Map<string, Stage>;
  tradeById: Map<string, Trade>;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  /** Selection mode: a checkbox is shown instead of relying on the action buttons */
  selectMode?: boolean;
  selected?: boolean;
  onToggleSelect?: (id: string) => void;
}

/** One row in the task list. Memoised, and the browser skips layout/paint for cards that are off-screen. */
export const TaskCard = memo(function TaskCard({ task: t, number, stageById, tradeById, onEdit, onDelete, onDuplicate, selectMode, selected, onToggleSelect }: TaskCardProps) {
  return (
    <div
      style={{ contentVisibility: "auto", containIntrinsicSize: "auto 170px" }}
      className={`bg-white border p-4 rounded-xl flex flex-col gap-3 shadow-2xs hover:shadow-xs transition relative ${
        t.isCritical ? "border-l-4 border-l-red-500 ring-1 ring-red-500/10" : "border-slate-200"
      } ${selected ? "ring-2 ring-sky-500 bg-sky-50/40" : ""} ${selectMode ? "cursor-pointer" : ""}`}
      onClick={selectMode ? () => onToggleSelect?.(t.id) : undefined}
    >
      {selectMode && (
        <label className="absolute top-3 right-3 z-10 flex items-center gap-1.5 text-[10px] font-extrabold text-slate-500 cursor-pointer">
          <input
            type="checkbox"
            data-testid="select-task"
            aria-label={`Markér ${t.title}`}
            checked={!!selected}
            readOnly
            className="w-4 h-4 accent-sky-600 cursor-pointer"
          />
        </label>
      )}
      <div className="flex justify-between items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <h4 className="font-black text-xs md:text-sm text-slate-800 tracking-tight truncate max-w-[180px] xs:max-w-full">
              {number}. {t.title}
            </h4>
            {t.isCritical && (
              <span className="bg-red-50 border border-red-200 text-red-700 font-extrabold text-[8px] md:text-[9px] px-2 py-0.5 rounded-full flex items-center gap-0.5">
                <Flame className="w-2.5 h-2.5 text-red-500 fill-red-500 shrink-0" />
                <span>Kritisk</span>
              </span>
            )}
          </div>
          
          {/* Stage Etape Badge & Recurrence Badge Row */}
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {t.stageId && (() => {
              const stg = stageById.get(t.stageId);
              if (!stg) return null;
              return (
                <span
                  className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[9px] font-extrabold leading-tight shadow-3xs"
                  style={{
                    backgroundColor: `${stg.color}12`,
                    color: stg.color,
                    borderColor: `${stg.color}30`,
                    borderWidth: "1px",
                  }}
                >
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: stg.color }} />
                  <span>{stg.name}</span>
                </span>
              );
            })()}

            {t.isRecurring && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[9px] font-extrabold leading-tight bg-slate-50 text-slate-750 border border-slate-200 shadow-3xs">
                <span className="inline-flex rounded-full h-1.5 w-1.5 bg-slate-500"></span>
                <span>Tjeneste: Gentages hver {t.recurringInterval} dag</span>
              </span>
            )}
          </div>

          {t.desc && <p className="text-[11px] md:text-xs text-slate-450 mt-2.5 font-medium leading-normal">{t.desc}</p>}
        </div>

        <div className={`flex gap-1 shrink-0 ${selectMode ? "invisible" : ""}`}>
          <button
            onClick={() => onEdit(t.id)}
            className="p-2 bg-slate-50 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer border border-slate-100 transition active:scale-95 min-h-[36px] min-w-[36px] flex items-center justify-center"
            title="Rediger"
            aria-label="Rediger opgave"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onDuplicate(t.id)}
            className="p-2 bg-slate-50 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer border border-slate-100 transition active:scale-95 min-h-[36px] min-w-[36px] flex items-center justify-center"
            title="Dupliker"
            aria-label="Dupliker opgave"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onDelete(t.id)}
            className="p-2 bg-red-50 hover:bg-red-100 text-red-400 hover:text-red-700 rounded-lg cursor-pointer border-0 transition active:scale-95 min-h-[36px] min-w-[36px] flex items-center justify-center"
            title="Slet"
            aria-label="Slet opgave"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {clockText(t) && (
        <div className="text-[10px] font-bold text-slate-500" data-testid="card-clock">
          {durationText(t)} &middot; {clockText(t)}
        </div>
      )}

      {/* Calendar info card */}
      <div className="grid grid-cols-2 bg-slate-50 border border-slate-100 p-2 rounded-lg text-[10px] font-bold text-slate-600 gap-2">
        <div>
          <span className="text-slate-400 text-[8px] uppercase tracking-wider block leading-none mb-1">
            {t.isRecurring ? "Første udførelse" : "Startdato"}
          </span>
          <span className="block truncate font-mono">
            {t.isRecurring ? "↻ " : "🏁 "}
            {t.calcStart ? new Date(`${t.calcStart}T12:00:00`).toLocaleDateString("da-DK") : "Afventer"}
          </span>
        </div>
        <div className="text-right">
          <span className="text-slate-400 text-[8px] uppercase tracking-wider block leading-none mb-1">
            {t.isRecurring ? "Sidste udførelse (Beregnet)" : "Slutdato"}
          </span>
          <span className="block truncate font-mono">
            {t.isRecurring ? `✓ (${(t.occurrences || []).length} gentagelser)` : "🏆 "}
            {t.calcEnd ? new Date(`${t.calcEnd}T12:00:00`).toLocaleDateString("da-DK") : "Afventer"}
          </span>
        </div>
      </div>

      {/* Badges resources and pricing inside the card */}
      <div className="flex justify-between items-center mt-0.5 flex-wrap gap-2 text-[10px]">
        <div className="flex gap-1 flex-wrap">
          {(t.tradeIds || []).map((tid) => {
            const tr = tradeById.get(tid);
            if (!tr) return null;
            return (
              <span
                key={tr.id}
                className="px-2 py-0.5 rounded-full font-bold border shrink-0 text-[10px]"
                style={{
                  backgroundColor: `${tr.color}15`,
                  color: tr.color,
                  borderColor: `${tr.color}35`,
                }}
              >
                {tr.name}
              </span>
            );
          })}
          {(t.tradeIds || []).length === 0 && (
            <span className="text-slate-400 font-medium">Ingen faggrupper</span>
          )}
        </div>

        <div className="font-extrabold text-xs text-slate-800 font-mono">
          {(t.calcCost || 0).toLocaleString("da-DK")} kr.
        </div>
      </div>
      {(t.assignments || []).length > 0 && (
        <div className="text-[10px] text-slate-500 font-semibold leading-snug" data-testid="card-crew">
          {(t.assignments || [])
            .map((a) => {
              const roles = tradeById.get(a.tradeId)?.roles || [];
              const crew = a.crew.map((c) => `${c.count} ${(roles.find((r) => r.id === c.roleId)?.name ?? "?").toLowerCase()}`).join(" + ");
              return `${a.label || "Aktivitet"}: ${crew}`;
            })
            .join(" · ")}
        </div>
      )}
    </div>
  );
});
