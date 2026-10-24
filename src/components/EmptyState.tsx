import { LayoutTemplate, PlusCircle } from "lucide-react";

interface Props {
  onTemplate: () => void;
  onFirstTask: () => void;
}

/** Shown on the schedule tab while the project has no tasks yet. */
export function EmptyState({ onTemplate, onFirstTask }: Props) {
  return (
    <div data-testid="empty-state" className="bg-white border border-slate-200 rounded-2xl p-6 md:p-12 flex flex-col items-center text-center gap-5 shadow-xs">
      <div>
        <h2 className="text-xl md:text-2xl font-extrabold text-slate-900">Her er ingen opgaver endnu</h2>
        <p className="text-sm md:text-base text-slate-600 font-medium mt-2 max-w-xl">
          Start med en færdig skabelon, du kan tilpasse, eller opret den første opgave selv.
        </p>
      </div>
      <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
        <button
          type="button"
          data-testid="empty-template"
          onClick={onTemplate}
          className="flex items-center justify-center gap-2 px-6 py-4 min-h-[56px] rounded-xl bg-slate-900 hover:bg-black text-white text-base font-bold cursor-pointer shadow-sm"
        >
          <LayoutTemplate className="w-5 h-5" />
          <span>Start fra skabelon</span>
        </button>
        <button
          type="button"
          data-testid="empty-first-task"
          onClick={onFirstTask}
          className="flex items-center justify-center gap-2 px-6 py-4 min-h-[56px] rounded-xl bg-white hover:bg-slate-50 border-2 border-slate-300 text-slate-800 text-base font-bold cursor-pointer"
        >
          <PlusCircle className="w-5 h-5" />
          <span>Opret første opgave</span>
        </button>
      </div>
    </div>
  );
}
