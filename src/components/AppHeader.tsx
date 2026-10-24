import React from "react";
import { FolderDown, FolderUp, FilePlus2, Undo2, Redo2, ShieldAlert, Moon, Sun, Search } from "lucide-react";

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

export function AppHeader(p: Props) {
  const time = p.savedAt ? new Date(p.savedAt).toLocaleTimeString("da-DK", { hour: "2-digit", minute: "2-digit" }) : null;
  return (
    <header className="bg-slate-50 border-b border-slate-200 text-slate-800 px-3 md:px-6 py-3 md:py-4 flex justify-between items-center gap-2 sticky top-0 z-50 shadow-xs print:hidden">
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="w-9 h-9 md:w-10 md:h-10 bg-slate-800 rounded-xl flex items-center justify-center text-white font-black text-lg md:text-xl shadow-md leading-none shrink-0">
          MD
        </div>
        <div className="min-w-0">
          <h1 data-testid="header-title" className="text-sm md:text-base font-extrabold text-slate-800 mb-0 truncate">
            {p.projectName || "MD Project"}
            {p.endDate && (
              <span data-testid="header-end" className="ml-2 text-xs md:text-sm font-bold text-slate-600">
                · Slut {new Date(`${p.endDate}T12:00:00`).toLocaleDateString("da-DK", { day: "numeric", month: "short", year: "numeric" })}
              </span>
            )}
          </h1>
          <span
            data-testid="save-status"
            className={`text-xs md:text-xs font-bold block leading-tight ${p.saveFailed ? "text-red-600" : "text-slate-500"}`}
          >
            {p.saveFailed ? "Kunne ikke gemme i browseren" : time ? `Gemt i browseren kl. ${time}` : "Gemmes automatisk i browseren"}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-1.5 flex-wrap justify-end">
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
          <Search className="w-4 h-4 text-slate-500" />
          <span className="hidden md:inline text-slate-500 font-medium">Søg</span>
          <kbd className="hidden lg:inline text-xs text-slate-500 border border-slate-300 rounded px-1">Ctrl K</kbd>
        </button>
        <button type="button" onClick={p.onToggleDark} className={btn} title={p.dark ? "Lys tilstand" : "Mørk tilstand"} aria-label="Skift mellem lys og mørk tilstand" data-testid="toggle-dark">
          {p.dark ? <Sun className="w-4 h-4 text-slate-500" /> : <Moon className="w-4 h-4 text-slate-500" />}
        </button>
        <button type="button" onClick={p.onUndo} disabled={!p.canUndo} className={btn} title="Fortryd (Ctrl+Z)" aria-label="Fortryd">
          <Undo2 className="w-4 h-4 text-slate-500" />
        </button>
        <button type="button" onClick={p.onRedo} disabled={!p.canRedo} className={btn} title="Gentag (Ctrl+Y)" aria-label="Gentag">
          <Redo2 className="w-4 h-4 text-slate-500" />
        </button>
        <button type="button" onClick={p.onNew} className={btn} title="Start et nyt projekt">
          <FilePlus2 className="w-4 h-4 text-slate-500" />
          <span className="hidden sm:inline">Nyt</span>
        </button>
        <button type="button" onClick={p.onExport} className={btn} title="Download projektfil (Gem)">
          <FolderDown className="w-4 h-4 text-slate-500" />
          <span className="hidden sm:inline">Gem</span>
        </button>
        <label className={btn} title="Åbn en projektfil">
          <FolderUp className="w-4 h-4 text-slate-500" />
          <span className="hidden sm:inline">Åbn</span>
          <input type="file" onChange={p.onImport} accept=".json" className="hidden" />
        </label>
      </div>
    </header>
  );
}
