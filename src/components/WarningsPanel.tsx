import { useState } from "react";
import { TriangleAlert, ChevronDown, ChevronUp } from "lucide-react";
import type { PlanWarning } from "../utils/warnings";
import { Wrench } from "lucide-react";

const MAX_SHOWN = 40;

/** Collapsible list of plan warnings; clicking one opens the task it is about. */
export function WarningsPanel({ warnings, onOpenTask, onFix }: { warnings: PlanWarning[]; onOpenTask: (id: string) => void; onFix?: (w: PlanWarning) => void }) {
  const [open, setOpen] = useState(false);
  if (warnings.length === 0) return null;
  const shown = warnings.slice(0, MAX_SHOWN);

  return (
    <div data-testid="warnings-panel" className="bg-amber-50 border border-amber-200 rounded-xl text-amber-900 print:hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="w-full px-4 py-2.5 flex items-center justify-between gap-2 text-xs font-extrabold cursor-pointer"
      >
        <span className="flex items-center gap-2">
          <TriangleAlert className="w-4 h-4 text-amber-500" />
          {warnings.length} {warnings.length === 1 ? "advarsel" : "advarsler"} i tidsplanen
        </span>
        {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>
      {open && (
        <ul className="px-4 pb-3 flex flex-col gap-1 border-t border-amber-200/70 pt-2">
          {shown.map((w) => (
            <li key={w.id} className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-3 py-1">
              <button
                type="button"
                onClick={() => onOpenTask(w.taskIds[0])}
                className="text-left text-xs font-semibold leading-snug hover:underline cursor-pointer flex-1 min-w-0"
              >
                {w.message}
              </button>
              {w.fix && onFix && (
                <button
                  type="button"
                  data-testid="warning-fix"
                  onClick={() => onFix(w)}
                  className="shrink-0 self-start sm:self-auto flex items-center gap-1.5 px-3 py-1.5 min-h-[36px] rounded-lg bg-white border border-amber-300 hover:bg-amber-100 text-xs font-bold text-amber-900 cursor-pointer"
                >
                  <Wrench className="w-3.5 h-3.5" />
                  {w.fix.label}
                </button>
              )}
            </li>
          ))}
          {warnings.length > shown.length && (
            <li className="text-xs font-bold text-amber-700">… og {warnings.length - shown.length} flere</li>
          )}
        </ul>
      )}
    </div>
  );
}
