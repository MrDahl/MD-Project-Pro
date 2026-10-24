import { useEscapeKey } from "./useEscapeKey";
import { TEMPLATE_LIST } from "../data/templates";

interface Props {
  open: boolean;
  hasContent: boolean;
  onSaveFirst: () => void;
  onConfirm: () => void;
  onTemplate: (id: string) => void;
  onCancel: () => void;
}

/** Confirms starting over, so the current project is never lost by accident. */
export function NewProjectDialog({ open, hasContent, onSaveFirst, onConfirm, onTemplate, onCancel }: Props) {
  useEscapeKey(onCancel);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[70] bg-slate-900/50 flex items-center justify-center p-4" onClick={onCancel}>
      <div
        id="new-project-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-project-title"
        className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full p-5 flex flex-col gap-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="new-project-title" className="text-base font-black text-slate-900">
          Start et nyt projekt?
        </h2>
        <p className="text-xs text-slate-600 leading-relaxed">
          {hasContent
            ? "Dit nuværende projekt bliver erstattet. Gem det som fil først, hvis du vil beholde det - du kan også fortryde bagefter."
            : "Guiden hjælper dig i gang med et nyt projekt."}
        </p>
        <div className="flex flex-col gap-1.5" data-testid="template-list">
          <span className="text-xs font-black text-slate-600">Eller start fra en skabelon</span>
          {TEMPLATE_LIST.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => onTemplate(t.id)}
              className="text-left px-3 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 hover:border-slate-300 cursor-pointer"
            >
              <span className="block text-xs font-extrabold text-slate-800">{t.name}</span>
              <span className="block text-xs text-slate-600 font-medium">{t.description}</span>
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2 justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="px-3.5 py-2 rounded-lg text-xs font-extrabold text-slate-600 bg-slate-100 hover:bg-slate-200 cursor-pointer"
          >
            Annuller
          </button>
          {hasContent && (
            <button
              type="button"
              onClick={onSaveFirst}
              className="px-3.5 py-2 rounded-lg text-xs font-extrabold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 cursor-pointer"
            >
              Gem fil først
            </button>
          )}
          <button
            type="button"
            onClick={onConfirm}
            className="px-3.5 py-2 rounded-lg text-xs font-extrabold text-white bg-slate-900 hover:bg-black cursor-pointer"
          >
            Start med guiden
          </button>
        </div>
      </div>
    </div>
  );
}
