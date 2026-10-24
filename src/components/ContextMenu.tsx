import { useEffect, useRef } from "react";
import { Copy, Pencil, Trash2 } from "lucide-react";

export interface ContextMenuState {
  x: number;
  y: number;
  taskId: string;
  title: string;
}

interface Props {
  menu: ContextMenuState;
  onEdit: (id: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

/** Right-click menu for a task (bar or card). */
export function ContextMenu({ menu, onEdit, onDuplicate, onDelete, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent && e.key !== "Escape") return;
      if (e instanceof MouseEvent && ref.current?.contains(e.target as Node)) return;
      onClose();
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    window.addEventListener("scroll", onClose, true);
    window.addEventListener("resize", onClose);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
      window.removeEventListener("scroll", onClose, true);
      window.removeEventListener("resize", onClose);
    };
  }, [onClose]);

  const left = Math.max(8, Math.min(menu.x, window.innerWidth - 220));
  const top = Math.max(8, Math.min(menu.y, window.innerHeight - 190));
  const item = "flex items-center gap-2.5 px-3 py-2.5 min-h-[40px] rounded-lg text-sm font-bold text-left cursor-pointer w-full";
  return (
    <div
      ref={ref}
      role="menu"
      data-testid="context-menu"
      style={{ left, top }}
      className="fixed z-[90] w-52 bg-white border border-slate-200 shadow-xl rounded-xl p-1.5 flex flex-col"
    >
      <div className="px-3 py-1.5 text-xs font-bold text-slate-500 truncate">{menu.title}</div>
      <button type="button" role="menuitem" className={`${item} text-slate-800 hover:bg-slate-100`} onClick={() => { onClose(); onEdit(menu.taskId); }}>
        <Pencil className="w-4 h-4 shrink-0" /> Rediger
      </button>
      <button type="button" role="menuitem" data-testid="ctx-duplicate" className={`${item} text-slate-800 hover:bg-slate-100`} onClick={() => { onClose(); onDuplicate(menu.taskId); }}>
        <Copy className="w-4 h-4 shrink-0" /> Dupliker
      </button>
      <button type="button" role="menuitem" data-testid="ctx-delete" className={`${item} text-red-700 hover:bg-red-50`} onClick={() => { onClose(); onDelete(menu.taskId); }}>
        <Trash2 className="w-4 h-4 shrink-0" /> Slet
      </button>
    </div>
  );
}
