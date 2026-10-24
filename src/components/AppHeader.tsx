import React, { useEffect, useRef, useState } from "react";
import { FolderDown, FolderUp, FilePlus2, Undo2, Redo2, ShieldAlert, Moon, Sun, Search, MoreHorizontal } from "lucide-react";

interface Props {
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onNew: () => void;
  onExport: () => void;
  onImport: (e: React.ChangeEvent<HTMLInputElement>) => void;
  savedAt: number | null;
  saveFailed: boolean;
  backupDue: boolean;
  projectName: string;
  endDate: string | null;
  dark: boolean;
  onToggleDark: () => void;
  onSearch: () => void;
}

const btn =
  "px-3 py-2 min-h-[40px] md:min-h-[36px] bg-white hover:bg-slate-100 active:scale-95 transition text-slate-700 rounded-lg border border-slate-200 cursor-pointer text-xs font-extrabold flex items-center gap-1.5 shadow-2xs disabled:opacity-40 disabled:cursor-default disabled:hover:bg-white";

const btnDesk = btn + " max-sm:hidden";

function PhoneMenu(p: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent && e.key !== "Escape") return;
      if (e instanceof MouseEvent && ref.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);
  const item = "flex items-center gap-3 px-3 py-3 min-h-[48px] rounded-lg text-sm font-bold text-slate-800 hover:bg-slate-100 cursor-pointer w-full text-left disabled:opacity-40";
  const go = (fn: () => void) => () => {
    setOpen(false);
    fn();
  };
  return (
    <div ref={ref} className="relative sm:hidden">
      <button type="button" data-testid="phone-menu" aria-label="Flere valg" aria-expanded={open} onClick={() => setOpen(!open)} className={btn}>
        <MoreHorizontal className="w-5 h-5 text-slate-600" />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-full mt-1.5 z-50 w-60 bg-white border border-slate-200 shadow-xl rounded-xl p-1.5">
          <button type="button" role="menuitem" className={item} disabled={!p.canUndo} onClick={go(p.onUndo)}><Undo2 className="w-4 h-4" />Fortryd</button>
          <button type="button" role="menuitem" className={item} disabled={!p.canRedo} onClick={go(p.onRedo)}><Redo2 className="w-4 h-4" />Gentag</button>
          <div className="my-1 border-t border-slate-100" />
          <button type="button" role="menuitem" className={item} onClick={go(p.onNew)}><FilePlus2 className="w-4 h-4" />Nyt projekt</button>
          <button type="button" role="menuitem" className={item} onClick={go(p.onExport)}><FolderDown className="w-4 h-4" />Gem projektfil</button>
          <label className={item}>
            <FolderUp className="w-4 h-4" />Åbn projektfil
            <input
              type="file"
              accept=".json"
              className="hidden"
              onChange={(e) => {
                setOpen(false);
                p.onImport(e);
              }}
            />
          </label>
          <div className="my-1 border-t border-slate-100" />
          <button type="button" role="menuitem" className={item} onClick={go(p.onToggleDark)}>
            {p.dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            {p.dark ? "Lys tilstand" : "Mørk tilstand"}
          </button>
        </div>
      )}
    </div>
  );
}

export function AppHeader(p: Props) {
  const time = p.savedAt ? new Date(p.savedAt).toLocaleTimeString("da-DK", { hour: "2-digit", minute: "2-digit" }) : null;
  return (
    <header className="bg-slate-50 border-b border-slate-200 text-slate-800 px-3 md:px-6 py-3 md:py-4 flex justify-between items-center gap-2 sm:sticky top-0 z-50 shadow-xs print:hidden">
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="w-9 h-9 md:w-10 md:h-10 bg-slate-800 rounded-xl flex items-center justify-center text-white font-black text-lg md:text-xl shadow-md leading-none shrink-0">
          MD
        </div>
        <div className="min-w-0">
          <h1 data-testid="header-title" className="text-sm md:text-base font-extrabold text-slate-800 mb-0 sm:truncate leading-tight">
            {p.projectName || "MD Project"}
            {p.endDate && (
              <span data-testid="header-end" className="hidden sm:inline ml-2 text-xs md:text-sm font-bold text-slate-600">
                · Slut {new Date(`${p.endDate}T12:00:00`).toLocaleDateString("da-DK", { day: "numeric", month: "short", year: "numeric" })}
              </span>
            )}
          </h1>
          <span
            data-testid="save-status"
            className={`hidden sm:block text-xs md:text-xs font-bold leading-tight ${p.saveFailed ? "text-red-600" : "text-slate-600"}`}
          >
            {p.saveFailed ? "Kunne ikke gemme i browseren" : time ? `Gemt i browseren kl. ${time}` : "Gemmes automatisk i browseren"}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-1.5 sm:flex-wrap justify-end shrink-0">
        <PhoneMenu {...p} />
        {p.backupDue && (
          <button
            type="button"
            onClick={p.onExport}
            className="hidden md:flex px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-lg border border-amber-200 cursor-pointer text-xs font-extrabold items-center gap-1.5"
            title="Du har ikke downloadet en sikkerhedskopi på det seneste"
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Tag en sikkerhedskopi</span>
          </button>
        )}
        <button type="button" onClick={p.onSearch} className={btn} title="Søg (Ctrl+K)" aria-label="Søg" data-testid="open-search">
          <Search className="w-4 h-4 text-slate-600" />
          <span className="hidden md:inline text-slate-600 font-medium">Søg</span>
          <kbd className="hidden lg:inline text-xs text-slate-600 border border-slate-300 rounded px-1">Ctrl K</kbd>
        </button>
        <button type="button" onClick={p.onToggleDark} className={btnDesk} title={p.dark ? "Lys tilstand" : "Mørk tilstand"} aria-label="Skift mellem lys og mørk tilstand" data-testid="toggle-dark">
          {p.dark ? <Sun className="w-4 h-4 text-slate-600" /> : <Moon className="w-4 h-4 text-slate-600" />}
        </button>
        <button type="button" onClick={p.onUndo} disabled={!p.canUndo} className={btnDesk} title="Fortryd (Ctrl+Z)" aria-label="Fortryd">
          <Undo2 className="w-4 h-4 text-slate-600" />
        </button>
        <button type="button" onClick={p.onRedo} disabled={!p.canRedo} className={btnDesk} title="Gentag (Ctrl+Y)" aria-label="Gentag">
          <Redo2 className="w-4 h-4 text-slate-600" />
        </button>
        <button type="button" onClick={p.onNew} className={btnDesk} title="Start et nyt projekt">
          <FilePlus2 className="w-4 h-4 text-slate-600" />
          <span className="hidden sm:inline">Nyt</span>
        </button>
        <button type="button" onClick={p.onExport} className={btnDesk} title="Download projektfil (Gem)">
          <FolderDown className="w-4 h-4 text-slate-600" />
          <span className="hidden sm:inline">Gem</span>
        </button>
        <label className={btnDesk} title="Åbn en projektfil">
          <FolderUp className="w-4 h-4 text-slate-600" />
          <span className="hidden sm:inline">Åbn</span>
          <input type="file" onChange={p.onImport} accept=".json" className="hidden" />
        </label>
      </div>
    </header>
  );
}
