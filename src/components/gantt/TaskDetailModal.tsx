import type { Task, Trade } from "../../types";
import { multiColorGradient } from "./model";
import { durationText, clockText } from "../../utils/tasks";
import { useEscapeKey } from "../useEscapeKey";
import { taskLinks } from "../../utils/links";
import { X, Flame, ExternalLink, CloudLightning, Sun, ArrowLeft, ArrowRight } from "lucide-react";

interface TaskDetailModalProps {
  task: Task;
  tradeById: Map<string, Trade>;
  onEdit: (task: Task) => void;
  /** All tasks, used to list predecessors and successors */
  allTasks: Task[];
  /** Close the window and scroll the chart to another task */
  onGoto: (task: Task) => void;
  onClose: () => void;
}

export function TaskDetailModal({ task, tradeById, onEdit, allTasks, onGoto, onClose }: TaskDetailModalProps) {
  useEscapeKey(onClose);
  const byId = new Map(allTasks.map((t) => [t.id, t]));
  const preds = taskLinks(task).map((l) => byId.get(l.taskId)).filter((t): t is Task => !!t);
  const succs = allTasks.filter((t) => t.id !== task.id && taskLinks(t).some((l) => l.taskId === task.id));
  const jump = (t: Task) => {
    onClose();
    onGoto(t);
  };
  const chip = "inline-flex items-center gap-1.5 max-w-full px-2.5 py-1.5 min-h-[36px] rounded-lg border border-slate-200 bg-white hover:bg-sky-50 hover:border-sky-300 text-xs font-bold text-slate-700 cursor-pointer text-left";
  return (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4" id="task-detail-modal" onClick={onClose}>
            <div role="dialog" aria-modal="true" aria-label={`Opgave: ${task.title}`} onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl shadow-2xl w-full max-w-md border border-slate-100 overflow-hidden flex flex-col">
              {/* Header with trade color borders */}
              <div 
                className="h-2.5 w-full shrink-0" 
                style={{ background: multiColorGradient(task.tradeIds || [], tradeById) }} 
              />
            
              <div className="p-5 flex flex-col gap-4">
                <div className="flex justify-between items-start gap-3">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-black text-slate-600 tabular-nums">Opgaveinformation</span>
                      {task.isCritical && (
                        <span className="bg-red-50 text-red-600 border border-red-200 text-xs font-black px-1.5 py-0.5 rounded flex items-center gap-0.5 shrink-0 animate-pulse">
                          <Flame className="w-2.5 h-2.5 fill-red-500 text-red-500" />
                          Kritisk vej
                        </span>
                      )}
                    </div>
                    <h3 className="text-base font-black text-slate-800 mt-1 leading-snug">
                      {task.title}
                    </h3>
                  </div>
                  <button
                    onClick={() => onClose()}
                    className="p-1 hover:bg-slate-100 rounded-lg text-slate-600 hover:text-slate-600 cursor-pointer transition shrink-0"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {task.desc && (
                  <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-lg border border-slate-100 font-medium">
                    {task.desc}
                  </p>
                )}

                {/* Stats Grid */}
                <div className="grid grid-cols-2 gap-3.5 bg-slate-50/50 p-3.5 rounded-xl border border-slate-150">
                  <div className="flex flex-col">
                    <span className="text-xs font-black text-slate-600">Tidsrum</span>
                    <span className="text-xs font-extrabold text-slate-700 mt-1">
                      {task.calcStart && task.calcEnd 
                        ? `${new Date(`${task.calcStart}T12:00:00`).toLocaleDateString("da-DK", { day: "numeric", month: "short" })} - ${new Date(`${task.calcEnd}T12:00:00`).toLocaleDateString("da-DK", { day: "numeric", month: "short" })}`
                        : "Ikke planlagt"}
                    </span>
                    {clockText(task) && <span className="text-xs font-bold text-slate-600">{clockText(task)}</span>}
                  </div>

                  <div className="flex flex-col">
                    <span className="text-xs font-black text-slate-600">Varighed</span>
                    <span className="text-xs font-extrabold text-slate-700 mt-1">
                      {durationText(task)}
                    </span>
                  </div>

                  <div className="flex flex-col">
                    <span className="text-xs font-black text-slate-600">Total Udgift</span>
                    <span className="text-sm font-black text-slate-800 mt-1 tabular-nums">
                      {(task.calcCost || 0).toLocaleString("da-DK")} kr.
                    </span>
                  </div>

                  <div className="flex flex-col">
                    <span className="text-xs font-black text-slate-600">Status / Fremdrift</span>
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-slate-755 rounded-full" 
                          style={{ width: `${task.progress || 0}%` }} 
                        />
                      </div>
                      <span className="text-xs font-bold text-slate-600 tabular-nums leading-none">
                        {task.progress || 0}%
                      </span>
                    </div>
                  </div>
                </div>

                {/* Metadata Indicators (Weekend, holiday, weather constraints) */}
                <div className="flex flex-wrap gap-1.5">
                  {task.allowWeekend && (
                    <span className="text-xs font-extrabold bg-indigo-50 border border-indigo-200 text-indigo-700 px-2 py-0.5 rounded-md leading-none">
                      Kørsel i weekender tilladt
                    </span>
                  )}
                  {task.allowHoliday && (
                    <span className="text-xs font-extrabold bg-purple-50 border border-purple-200 text-purple-700 px-2 py-0.5 rounded-md leading-none">
                      Arbejde på helligdage tilladt
                    </span>
                  )}
                  {task.weatherIndependent ? (
                    <span className="text-xs font-extrabold bg-emerald-50 border border-emerald-200 text-emerald-700 px-2 py-0.5 rounded-md leading-none flex items-center gap-0.5">
                      <Sun className="w-3 h-3 text-emerald-500" />
                      <span>Løbende uafhængig af uvejr</span>
                    </span>
                  ) : (
                    <span className="text-xs font-extrabold bg-amber-50 border border-amber-200 text-amber-700 px-2 py-0.5 rounded-md leading-none flex items-center gap-0.5">
                      <CloudLightning className="w-3 h-3 text-amber-500" />
                      <span>Vejrfølsom opgave (Sættes på pause)</span>
                    </span>
                  )}
                </div>

                {(preds.length > 0 || succs.length > 0) && (
                  <div className="flex flex-col gap-2" data-testid="detail-links">
                    {preds.length > 0 && (
                      <div className="flex flex-col gap-1">
                        <span className="text-xs font-black text-slate-600">Forgængere</span>
                        <div className="flex flex-wrap gap-1.5">
                          {preds.map((t) => (
                            <button key={t.id} type="button" data-testid="goto-pred" onClick={() => jump(t)} className={chip}>
                              <ArrowLeft className="w-3.5 h-3.5 shrink-0" />
                              <span className="truncate">{t.title}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    {succs.length > 0 && (
                      <div className="flex flex-col gap-1">
                        <span className="text-xs font-black text-slate-600">Efterfølgere</span>
                        <div className="flex flex-wrap gap-1.5">
                          {succs.map((t) => (
                            <button key={t.id} type="button" data-testid="goto-succ" onClick={() => jump(t)} className={chip}>
                              <span className="truncate">{t.title}</span>
                              <ArrowRight className="w-3.5 h-3.5 shrink-0" />
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-2.5 pt-1 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => {
                      onEdit(task);
                      onClose();
                    }}
                    className="flex-1 py-3 bg-slate-800 hover:bg-slate-900 active:bg-slate-950 text-white text-xs font-black rounded-xl flex items-center justify-center gap-1.5 cursor-pointer shadow-md transition"
                  >
                    <ExternalLink className="w-4 h-4 text-slate-350" />
                    <span>Rediger opgave</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onClose()}
                    className="px-4 py-3 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-xs font-black text-slate-600 cursor-pointer transition"
                  >
                    Luk
                  </button>
                </div>
              </div>
            </div>
          </div>
  );
}
