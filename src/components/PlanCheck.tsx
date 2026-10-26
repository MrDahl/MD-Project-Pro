import { CheckCircle2, AlertTriangle, Info, X } from "lucide-react";
import { useEscapeKey } from "./useEscapeKey";
import type { PlanCheckResult } from "../utils/planCheck";

interface Props {
  result: PlanCheckResult;
  onOpenTask: (id: string) => void;
  onClose: () => void;
}

/** "Tjek min plan": a friendly checklist with what is good and what to look at. */
export function PlanCheck({ result, onOpenTask, onClose }: Props) {
  useEscapeKey(onClose);
  const all = result.passed === result.total && result.total > 0;
  const pct = result.total ? Math.round((result.passed / result.total) * 100) : 0;
  return (
    <div className="fixed inset-0 z-[70] bg-slate-900/40 flex items-end sm:items-center justify-center sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Tjek min plan"
        data-testid="plan-check"
        onClick={(e) => e.stopPropagation()}
        className="bg-white w-full sm:max-w-xl max-h-[92vh] rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden"
      >
        <div className="px-5 pt-5 pb-3 border-b border-slate-100 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-lg font-extrabold text-slate-900">Tjek min plan</h2>
            <p data-testid="plan-check-score" className="text-sm font-semibold text-slate-600 mt-0.5">
              {all ? "Flot! Alle tjek er bestået." : `${result.passed} af ${result.total} tjek er bestået.`}
            </p>
            <div className="mt-2 h-2 w-48 max-w-full bg-slate-100 rounded-full overflow-hidden" aria-hidden="true">
              <div className={`h-full rounded-full ${all ? "bg-emerald-500" : "bg-sky-500"}`} style={{ width: `${pct}%` }} />
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Luk" className="p-2 -m-1 rounded-lg hover:bg-slate-100 text-slate-600 cursor-pointer shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>
        <ul className="overflow-y-auto p-3 flex flex-col gap-2">
          {result.items.map((it) => {
            const Icon = it.level === "ok" ? CheckCircle2 : it.level === "warn" ? AlertTriangle : Info;
            const color = it.level === "ok" ? "text-emerald-600" : it.level === "warn" ? "text-amber-600" : "text-sky-600";
            const bg = it.level === "warn" ? "bg-amber-50 border-amber-200" : "bg-white border-slate-200";
            return (
              <li key={it.id} data-testid="check-item" data-level={it.level} className={`flex gap-3 p-3 rounded-xl border ${bg}`}>
                <Icon className={`w-5 h-5 shrink-0 mt-0.5 ${color}`} />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-bold text-slate-900">{it.title}</div>
                  <p className="text-sm text-slate-700 leading-snug mt-0.5">{it.detail}</p>
                  {it.taskId && it.level !== "ok" && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenTask(it.taskId!);
                      }}
                      className="mt-1.5 text-sm font-bold text-sky-700 hover:underline cursor-pointer py-1"
                    >
                      Vis en opgave
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
