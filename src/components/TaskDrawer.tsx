import { X } from "lucide-react";
import { useEscapeKey } from "./useEscapeKey";

interface Props {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}

/** Slide-over panel from the right, used to create/edit tasks without leaving the current view. */
export function TaskDrawer({ title, onClose, children }: Props) {
  useEscapeKey(onClose);
  return (
    <div className="fixed inset-0 z-[65] flex justify-end bg-slate-900/40" onClick={onClose}>
      <aside
        id="task-drawer"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className="animate-drawer-in bg-slate-50 w-full max-w-xl h-full overflow-y-auto shadow-2xl border-l border-slate-200 flex flex-col"
      >
        <div className="sticky top-0 z-10 bg-slate-50/95 backdrop-blur-xs border-b border-slate-200 px-4 py-3 flex items-center justify-between">
          <h2 className="text-sm font-black text-slate-800">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Luk"
            className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-600 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4">{children}</div>
      </aside>
    </div>
  );
}
