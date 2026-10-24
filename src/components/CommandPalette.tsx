import { useEffect, useMemo, useRef, useState } from "react";
import { Search, CalendarDays, ListChecks } from "lucide-react";

export interface PaletteItem {
  id: string;
  label: string;
  hint: string;
  kind: "tab" | "task";
}

interface Props {
  items: PaletteItem[];
  onPick: (item: PaletteItem) => void;
  onClose: () => void;
}

/** Ctrl+K: search tasks and tabs, jump with the keyboard. */
export function CommandPalette({ items, onPick, onClose }: Props) {
  const [q, setQ] = useState("");
  const [idx, setIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => inputRef.current?.focus(), []);

  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    const list = t ? items.filter((i) => i.label.toLowerCase().includes(t) || i.hint.toLowerCase().includes(t)) : items;
    return list.slice(0, 40);
  }, [q, items]);
  useEffect(() => setIdx(0), [q]);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setIdx((i) => Math.min(shown.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setIdx((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (shown[idx]) onPick(shown[idx]);
    } else if (e.key === "Escape") {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-slate-900/40 flex items-start justify-center pt-[12vh] px-3" onMouseDown={onClose} data-testid="palette">
      <div className="w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 px-4 border-b border-slate-200">
          <Search className="w-5 h-5 text-slate-500 shrink-0" />
          <input
            ref={inputRef}
            data-testid="palette-input"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKey}
            placeholder="Søg efter opgave eller fane…"
            aria-label="Søg efter opgave eller fane"
            className="flex-1 py-4 text-base font-medium text-slate-800 outline-none bg-transparent"
          />
          <kbd className="hidden sm:block text-xs text-slate-500 border border-slate-300 rounded px-1.5 py-0.5">Esc</kbd>
        </div>
        <ul className="max-h-[50vh] overflow-y-auto p-1.5" role="listbox">
          {shown.length === 0 && <li className="px-3 py-6 text-center text-sm text-slate-500">Ingen resultater</li>}
          {shown.map((it, i) => (
            <li key={it.kind + it.id} role="option" aria-selected={i === idx}>
              <button
                type="button"
                data-testid="palette-item"
                onMouseEnter={() => setIdx(i)}
                onClick={() => onPick(it)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 min-h-[44px] rounded-lg text-left cursor-pointer ${i === idx ? "bg-sky-50" : ""}`}
              >
                {it.kind === "tab" ? <CalendarDays className="w-4 h-4 text-slate-500 shrink-0" /> : <ListChecks className="w-4 h-4 text-slate-500 shrink-0" />}
                <span className="flex-1 min-w-0 truncate text-sm font-bold text-slate-800">{it.label}</span>
                <span className="text-xs text-slate-500 shrink-0">{it.hint}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
