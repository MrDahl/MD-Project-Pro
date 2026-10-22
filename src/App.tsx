import React, { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppData, Task, Trade, Settings, ProjectInfo, Stage, Holiday } from "./types";
import { calculateSchedule } from "./utils/scheduler";
import { danishHolidays, projectYears } from "./utils/holidays";
import { indexBy } from "./components/gantt/model";
import { GanttChart } from "./components/gantt/GanttChart";
import { TaskCard } from "./components/TaskCard";
import { TaskForm } from "./components/TaskForm";
import { TradeForm } from "./components/TradeForm";
import { ProjectSettings } from "./components/ProjectSettings";
import {
  FolderUp,
  FolderDown,
  Printer,
  Trash2,
  ListChecks,
  CalendarDays,
  UsersRound,
  DollarSign,
  Settings as SettingsIcon,
  Info,
  XCircle,
  Pencil,
  PlusCircle,
  HelpCircle,
  FolderKanban,
  Menu,
  X,
} from "lucide-react";

// Rarely used views are loaded on demand to keep the first load small
const Glossary = lazy(() => import("./components/Glossary").then((m) => ({ default: m.Glossary })));
const Wizard = lazy(() => import("./components/Wizard").then((m) => ({ default: m.Wizard })));

const STORAGE_KEY = "msProjectMobileData";
const WIZARD_KEY = "msProjectWizardCompleted";

// Initialize baseline project start data if custom local storage is empty
const INITIAL_PROJECT_STATE: AppData = {
  startDate: "2026-06-22",
  settings: { workHoursPerDay: 7.4 },
  projectInfo: { projectName: "Nyt Projekt", address: "", customer: "", manager: "" },
  holidays: [],
  trades: [],
  tasks: [],
  stages: [],
  weatherDelays: [],
  scheduleError: null,
  startDateWarning: null,
};

/** Reads the saved project (tolerating older formats) or falls back to a blank one. */
function loadInitialState(): AppData {
  let saved: string | null = null;
  try {
    saved = localStorage.getItem(STORAGE_KEY);
  } catch {
    /* storage unavailable */
  }
  if (!saved) return INITIAL_PROJECT_STATE;

  try {
    const parsed = JSON.parse(saved);

    // Older versions stored holidays as plain date strings
    const rawHolidays: unknown[] = Array.isArray(parsed.holidays) ? parsed.holidays : [];
    const holidays: Holiday[] = rawHolidays
      .map((h, idx) => {
        const item = (typeof h === "string" ? { date: h } : h) as Partial<Holiday> | null;
        return {
          id: item?.id || `hol-norm-${idx}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          date: item?.date || "",
          name: item?.name || "Lukkedag / Ferie",
        };
      })
      .filter((h) => h.date);

    return {
      startDate: parsed.startDate || INITIAL_PROJECT_STATE.startDate,
      settings: parsed.settings || INITIAL_PROJECT_STATE.settings,
      projectInfo: parsed.projectInfo || INITIAL_PROJECT_STATE.projectInfo,
      holidays,
      trades: parsed.trades || [],
      tasks: parsed.tasks || [],
      stages: parsed.stages || [],
      weatherDelays: parsed.weatherDelays || [],
      scheduleError: null,
      startDateWarning: null,
    };
  } catch {
    return INITIAL_PROJECT_STATE;
  }
}

function saveState(state: AppData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* storage full or unavailable - the project can still be saved with "Gem" */
  }
}

export default function App() {
  const [activeTab, setActiveTab2] = useState<
    "tidsplan" | "resources" | "budget" | "settings" | "glossary"
  >("tidsplan");

  const [tidsplanView, setTidsplanView] = useState<"gantt" | "list">("gantt");

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(() => {
    // Hvis der ikke tidligere er fuldført en wizard, åbnes den automatisk
    try {
      return !localStorage.getItem(WIZARD_KEY);
    } catch {
      return true;
    }
  });

  const [appState, setAppState] = useState<AppData>(loadInitialState);

  const handleWizardComplete = (completedData: {
    projectInfo: ProjectInfo;
    startDate: string;
    settings: Settings;
    holidays: string[];
    stages: Stage[];
    trades: Trade[];
    includeDanishHolidays?: boolean;
  }) => {
    const year = parseInt(completedData.startDate.split("-")[0]) || new Date().getFullYear();
    const formattedHolidays: Holiday[] = (completedData.holidays || []).map((dateStr, idx) => ({
      id: `hol-wiz-${idx}-${Date.now()}`,
      date: dateStr,
      name: "Lukkedag / Ferie",
    }));

    if (completedData.includeDanishHolidays) {
      const fallback = danishHolidays(year);
      fallback.forEach((fH, fIdx) => {
        if (!formattedHolidays.some(h => h.date === fH.date)) {
          formattedHolidays.push({
            id: `hol-wiz-den-${fIdx}-${Date.now()}`,
            date: fH.date,
            name: fH.name
          });
        }
      });
    }

    // Sort combined holidays
    formattedHolidays.sort((a, b) => a.date.localeCompare(b.date));

    setAppState({
      startDate: completedData.startDate,
      settings: completedData.settings,
      projectInfo: completedData.projectInfo,
      holidays: formattedHolidays,
      trades: completedData.trades,
      stages: completedData.stages,
      tasks: [],
      scheduleError: null,
      startDateWarning: null,
    });
    try {
      localStorage.setItem(WIZARD_KEY, "true");
    } catch {
      /* storage unavailable */
    }
    setWizardOpen(false);
    triggerToast("Velkommen! Dit nye projekt er konfigureret med lukkedage.");
  };

  const [editTaskId, setEditTaskId] = useState<string | null>(null);
  const [editTradeId, setEditTradeId] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string>("");

  // The schedule is derived data: recalculated only when something it depends on changes
  // (typing in project info no longer triggers a full recalculation).
  const { tasks: calculatedTasks, projectEndDate, projectTotalCost, scheduleError, startDateWarning } = useMemo(
    () =>
      calculateSchedule(
        appState.tasks,
        appState.trades,
        appState.holidays,
        appState.settings,
        appState.startDate,
        appState.stages || [],
        appState.weatherDelays || []
      ),
    [appState.tasks, appState.trades, appState.holidays, appState.settings, appState.startDate, appState.stages, appState.weatherDelays]
  );

  const tradeById = useMemo(() => indexBy(appState.trades), [appState.trades]);
  const stageById = useMemo(() => indexBy(appState.stages || []), [appState.stages]);

  // Keep Danish public holidays present for every calendar year the project touches
  useEffect(() => {
    const missingYears = projectYears(appState.startDate, projectEndDate).filter(
      (y) => !appState.holidays.some((h) => h.date.startsWith(String(y)))
    );
    if (missingYears.length === 0) return;

    setAppState((p) => {
      const known = new Set(p.holidays.map((h) => h.date));
      const added = missingYears
        .flatMap((y) => danishHolidays(y))
        .filter((h) => !known.has(h.date))
        .map((h) => ({ id: `hol-auto-${h.date}`, date: h.date, name: h.name }));
      if (added.length === 0) return p;
      return { ...p, holidays: [...p.holidays, ...added].sort((a, b) => a.date.localeCompare(b.date)) };
    });
  }, [appState.startDate, appState.holidays, projectEndDate]);

  // Persist to localStorage, debounced so dragging/typing does not serialise the whole project on every change
  const stateRef = useRef(appState);
  stateRef.current = appState;
  useEffect(() => {
    const id = window.setTimeout(() => saveState(appState), 400);
    return () => window.clearTimeout(id);
  }, [appState]);
  useEffect(() => {
    const flush = () => saveState(stateRef.current);
    const onVisibility = () => document.visibilityState === "hidden" && flush();
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  const toastTimer = useRef<number | undefined>(undefined);
  const triggerToast = useCallback((msg: string) => {
    setToastMsg(msg);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToastMsg(""), 3500);
  }, []);

  // Task CRUD operations
  const handleSaveTask = (taskPayload: Omit<Task, "calcStart" | "calcEnd" | "calcCost" | "isCritical" | "tradeCosts">) => {
    let updatedTasks: Task[] = [];
    if (editTaskId) {
      updatedTasks = appState.tasks.map((t) => (t.id === editTaskId ? { ...t, ...taskPayload } : t));
      setEditTaskId(null);
      triggerToast("Opgaven er opdateret i dagsplanen.");
    } else {
      updatedTasks = [...appState.tasks, { ...taskPayload }];
      triggerToast("Ny opgave slynget på kalenderen!");
    }
    setAppState((p) => ({ ...p, tasks: updatedTasks }));
  };

  const handleDeleteTask = useCallback(
    (id: string) => {
      const hasPredecessorLink = stateRef.current.tasks.some((t) => t.dependencyId === id);
      setAppState((p) => ({
        ...p,
        tasks: p.tasks.filter((t) => t.id !== id).map((t) => (t.dependencyId === id ? { ...t, dependencyId: null } : t)),
      }));
      if (hasPredecessorLink) {
        alert("Bemærk! Den slettede opgave var sat som forgænger for andre opgaver. Disse afhængigheder er automatisk nulstillet.");
      }
      triggerToast("Opgaven blev slettet.");
    },
    [triggerToast]
  );

  // Trade CRUD operations
  const handleSaveTrade = (tradePayload: Trade) => {
    let updatedTrades: Trade[] = [];
    if (editTradeId) {
      updatedTrades = appState.trades.map((tr) => (tr.id === editTradeId ? { ...tr, ...tradePayload } : tr));
      setEditTradeId(null);
      triggerToast("Faggruppeoplysninger opdateret.");
    } else {
      updatedTrades = [...appState.trades, { ...tradePayload }];
      triggerToast("Faggruppe tilføjet til firmaet.");
    }
    setAppState((p) => ({ ...p, trades: updatedTrades }));
  };

  const handleDeleteTrade = (id: string) => {
    const isLinked = appState.tasks.some((t) => t.tradeIds?.includes(id));
    if (isLinked) {
      alert("Kan ikke slette faggruppe: Den er tilknyttet aktive opgaver i tidsplanen. Fjern tilknytningen først!");
      return;
    }
    setAppState((p) => ({ ...p, trades: p.trades.filter((tr) => tr.id !== id) }));
    triggerToast("Ressource slettet.");
  };

  const handleAddStage = (newStage: Stage) => {
    const updatedStages = [...(appState.stages || []), newStage];
    setAppState((p) => ({ ...p, stages: updatedStages }));
    triggerToast(`Etape "${newStage.name}" er oprettet!`);
  };

  const handleDeleteStage = (id: string) => {
    const updatedStages = (appState.stages || []).filter((stg) => stg.id !== id);
    const updatedTasks = appState.tasks.map((t) => {
      let isChanged = false;
      let newStageId = t.stageId;
      let newRecurStages = t.recurringStageIds;
      if (t.stageId === id) {
        newStageId = null;
        isChanged = true;
      }
      if (t.recurringStageIds?.includes(id)) {
        newRecurStages = t.recurringStageIds.filter(x => x !== id);
        isChanged = true;
      }
      return isChanged ? { ...t, stageId: newStageId, recurringStageIds: newRecurStages } : t;
    });
    setAppState((p) => ({ ...p, stages: updatedStages, tasks: updatedTasks }));
    triggerToast("Etape slettet.");
  };

  const handleUpdateProjectInfo = (info: ProjectInfo) => {
    setAppState((p) => ({ ...p, projectInfo: info }));
  };

  // Calendar parameters
  const handleUpdateStartDate = (date: string) => {
    setAppState((p) => ({ ...p, startDate: date }));
  };

  const handleUpdateWorkHours = (hours: number) => {
    setAppState((p) => ({
      ...p,
      settings: { ...p.settings, workHoursPerDay: hours },
    }));
  };

  const handleAddHoliday = (date: string, name: string = "Lukkedag") => {
    if (appState.holidays.some((h) => h.date === date)) return;
    const newHol: Holiday = {
      id: "hol-" + Date.now() + "-" + Math.random().toString(36).substr(2, 4),
      date,
      name: name || "Lukkedag"
    };
    setAppState((p) => ({
      ...p,
      holidays: [...p.holidays, newHol]
    }));
    triggerToast(`Lukkedag "${name}" markeret i kalenderen.`);
  };

  const handleDeleteHoliday = (idx: number) => {
    setAppState((p) => ({
      ...p,
      holidays: p.holidays.filter((_, i) => i !== idx),
    }));
    triggerToast("Fridag/Lukkedag fjernet.");
  };

  const handleAddWeatherDelay = (label: string, startDate: string, endDate: string) => {
    const newDelay = {
      id: "delay-" + Date.now(),
      label,
      startDate,
      endDate,
    };
    setAppState((p) => ({
      ...p,
      weatherDelays: [...(p.weatherDelays || []), newDelay],
    }));
    triggerToast(`Vejrspildsdage "${label}" registreret.`);
  };

  const handleDeleteWeatherDelay = (id: string) => {
    setAppState((p) => ({
      ...p,
      weatherDelays: (p.weatherDelays || []).filter((wd) => wd.id !== id),
    }));
    triggerToast("Vejrspildsdag fjernet.");
  };

  // Full export/import operations JSON
  const handleExportProject = () => {
    const rawName = appState.projectInfo?.projectName || "MD Project";
    const cleanName = rawName.trim().replace(/[^a-zA-Z0-9æøåÆØÅ\s-_]/g, "").replace(/\s+/g, "_");
    const filename = `${cleanName || "MD_Project"}.json`;

    const dataStr = JSON.stringify(appState, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    triggerToast(`Projektfil gemt som ${filename}!`);
  };

  const handleImportProject = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const imported = JSON.parse(event.target?.result as string);
        if (imported.tasks && imported.trades) {
          setAppState({
            startDate: imported.startDate || "2026-06-15",
            settings: imported.settings || { workHoursPerDay: 7.4 },
            projectInfo: imported.projectInfo || { projectName: "MD Project", address: "", customer: "", manager: "" },
            holidays: imported.holidays || [],
            trades: imported.trades || [],
            tasks: imported.tasks || [],
            stages: imported.stages || [],
            weatherDelays: imported.weatherDelays || [],
            scheduleError: null,
            startDateWarning: null,
          });
          setEditTaskId(null);
          setEditTradeId(null);
          triggerToast("MD Project-fil importeret succesfuldt!");
        } else {
          alert("Filen mangler gyldige moduler. Kontroller din JSON.");
        }
      } catch {
        alert("Fejl ved indlæsning af filen. Er du sikker på det er en gyldig JSON?");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  // Cost and task count per trade
  const tradeStats = useMemo(() => {
    const stats: { [tid: string]: { cost: number; count: number } } = {};
    appState.trades.forEach((tr) => {
      stats[tr.id] = { cost: 0, count: 0 };
    });
    calculatedTasks.forEach((t) => {
      if (!t.tradeCosts) return;
      for (const tid in t.tradeCosts) {
        if (stats[tid]) {
          stats[tid].cost += t.tradeCosts[tid];
          stats[tid].count += 1;
        }
      }
    });
    return stats;
  }, [appState.trades, calculatedTasks]);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans select-none antialiased">
      {/* Top Header Panel - Fully Responsive (Light Styled) */}
      <header className="bg-slate-50 border-b border-slate-200 text-slate-800 px-4 md:px-6 py-3 md:py-4 flex justify-between items-center sticky top-0 z-50 shadow-xs">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 md:w-10 md:h-10 bg-slate-800 rounded-xl flex items-center justify-center text-white font-black text-lg md:text-xl shadow-md border border-slate-750/20 select-none leading-none">
            MD
          </div>
          <div>
            <h1 className="text-xs md:text-sm font-black tracking-tight text-slate-800 mb-0">MD Project</h1>
            <span className="text-[9px] md:text-[10px] text-slate-500 font-extrabold block leading-none font-mono">
              version 0.8.4
            </span>
          </div>
        </div>

        {/* Action triggers */}
        <div className="flex items-center gap-1.5 print:hidden">
          <button
            onClick={handleExportProject}
            className="px-3.5 py-1.5 bg-white hover:bg-slate-100 active:scale-95 transition text-slate-700 rounded-lg border border-slate-200 cursor-pointer text-xs font-extrabold flex items-center gap-1.5 shadow-2xs"
            title="Download projektfil (Gem)"
          >
            <FolderDown className="w-4 h-4 text-slate-500" />
            <span>Gem</span>
          </button>

          <label className="px-3.5 py-1.5 bg-white hover:bg-slate-100 active:scale-95 transition text-slate-700 rounded-lg border border-slate-200 cursor-pointer text-xs font-extrabold flex items-center gap-1.5 shadow-2xs">
            <FolderUp className="w-4 h-4 text-slate-500" />
            <span>Åbn</span>
            <input type="file" onChange={handleImportProject} accept=".json" className="hidden" />
          </label>
        </div>
      </header>

      {/* Main Container Dashboard */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-3 md:p-6 flex flex-col gap-4 md:gap-5">
        
        {/* Modern high-density Page Title Section with FolderKanban and Project Name */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white border border-slate-200 p-4 rounded-xl shadow-xs">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-slate-100 text-slate-700 rounded-xl">
              <FolderKanban className="w-5 h-5 shrink-0" />
            </div>
            <div className="flex flex-col">
              <h2 className="text-base md:text-lg font-extrabold text-slate-900 leading-tight">
                {appState.projectInfo?.projectName || "MD Projekt"}
              </h2>
              {appState.projectInfo?.address ? (
                <p className="text-[10px] md:text-[11px] text-slate-500 font-semibold mt-0.5 whitespace-normal leading-relaxed">
                  {appState.projectInfo.address}
                  {appState.projectInfo.customer ? ` • Kunde: ${appState.projectInfo.customer}` : ""}
                  {appState.projectInfo.manager ? ` • Ansvarlig: ${appState.projectInfo.manager}` : ""}
                </p>
              ) : (
                <p className="text-[10px] md:text-[11px] text-slate-450 font-semibold mt-0.5">
                  Projektdetaljer og planlægningsoverblik
                </p>
              )}
            </div>
          </div>
        </div>

        {/* High Density KPI Statistics Metrics */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 md:gap-3 print:hidden">
          <div className="bg-white border border-slate-200 rounded-xl p-3 flex flex-col justify-between shadow-2xs">
            <span className="text-[8px] md:text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Total Sagspris</span>
            <div className="flex items-baseline gap-0.5 md:gap-1 flex-wrap">
              <span className="text-sm md:text-lg font-black font-mono text-slate-900">{projectTotalCost.toLocaleString("da-DK")}</span>
              <span className="text-[9px] md:text-[10px] font-black text-slate-450 font-mono">kr.</span>
            </div>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-3 flex flex-col justify-between shadow-2xs">
            <span className="text-[8px] md:text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Færdiggørelsesdato</span>
            <div className="flex items-baseline gap-1">
              <span className="text-sm md:text-lg font-black text-slate-900 font-mono">
                {projectEndDate ? new Date(`${projectEndDate}T12:00:00`).toLocaleDateString("da-DK", { day: "numeric", month: "short" }) : "Ingen"}
              </span>
            </div>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-3 flex flex-col justify-between shadow-2xs">
            <span className="text-[8px] md:text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Planlagte Opgaver</span>
            <div className="flex items-baseline gap-1">
              <span className="text-sm md:text-lg font-black text-slate-900 font-mono">{appState.tasks.length}</span>
              <span className="text-[9px] md:text-[10px] text-slate-400 font-mono font-black">sedler</span>
            </div>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-3 flex flex-col justify-between shadow-2xs">
            <span className="text-[8px] md:text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Personalefag</span>
            <div className="flex items-baseline gap-1">
              <span className="text-sm md:text-lg font-black text-slate-900 font-mono">{appState.trades.length}</span>
              <span className="text-[9px] md:text-[10px] text-slate-400 font-mono font-black">svende</span>
            </div>
          </div>
        </div>

        {/* Dynamic Warning and Alert banner overlays */}
        {scheduleError && (
          <div className="bg-red-50 border border-red-200 p-4 rounded-xl flex items-start gap-3 text-red-700 shadow-xs">
            <XCircle className="w-5 h-5 shrink-0 text-red-500 mt-0.5" />
            <div>
              <p className="text-xs font-bold">Kritiske planlægningsfejl fundet:</p>
              <p className="text-xs mt-0.5 leading-relaxed">{scheduleError}</p>
            </div>
          </div>
        )}

        {startDateWarning && !scheduleError && (
          <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl flex items-start gap-3 text-amber-800 shadow-xs select-none">
            <Info className="w-5 h-5 shrink-0 text-amber-500 mt-0.5" />
            <div>
              <p className="text-xs font-bold">Bemærk:</p>
              <p className="text-xs mt-0.5 leading-relaxed">{startDateWarning}</p>
            </div>
          </div>
        )}

        {/* Mobile Hamburger menu & Desktop Tab selector bar */}
        <div className="relative print:hidden select-none">
          {/* Mobile hamburger header (visible only on mobile) */}
          <div className="sm:hidden flex flex-col border border-slate-200 rounded-xl bg-white overflow-hidden shadow-2xs">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="w-full px-4 py-3 flex items-center justify-between font-extrabold text-sm text-slate-800 bg-slate-50 hover:bg-slate-100/80 transition cursor-pointer"
            >
              <div className="flex items-center gap-2">
                {activeTab === "tidsplan" && <CalendarDays className="w-5 h-5 text-slate-700" />}
                {activeTab === "resources" && <UsersRound className="w-5 h-5 text-slate-700" />}
                {activeTab === "budget" && <DollarSign className="w-5 h-5 text-slate-700" />}
                {activeTab === "settings" && <SettingsIcon className="w-5 h-5 text-slate-700" />}
                {activeTab === "glossary" && <HelpCircle className="w-5 h-5 text-slate-700" />}
                <span className="capitalize">
                  {activeTab === "tidsplan" && `Tidsplan (${appState.tasks.length})`}
                  {activeTab === "resources" && "Faggrupper"}
                  {activeTab === "budget" && "Økonomi"}
                  {activeTab === "settings" && "Projekt & Kalender"}
                  {activeTab === "glossary" && "Vidensbase"}
                </span>
              </div>
              <div className="p-1 rounded-md hover:bg-slate-200 transition">
                {mobileMenuOpen ? <X className="w-5 h-5 text-slate-600" /> : <Menu className="w-5 h-5 text-slate-600" />}
              </div>
            </button>

            {/* Mobile Expandable tab list with micro-animations */}
            {mobileMenuOpen && (
                <div className="divide-y divide-slate-100 bg-white animate-menu-in">
                  <button
                    onClick={() => {
                      setActiveTab2("tidsplan");
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full px-5 py-3 text-left font-bold text-xs flex items-center gap-3 transition cursor-pointer ${
                      activeTab === "tidsplan" ? "text-slate-900 bg-slate-100" : "text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <CalendarDays className="w-4 h-4 shrink-0" />
                    <span>Opgaver ({appState.tasks.length})</span>
                  </button>

                  <button
                    onClick={() => {
                      setActiveTab2("resources");
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full px-5 py-3 text-left font-bold text-xs flex items-center gap-3 transition cursor-pointer ${
                      activeTab === "resources" ? "text-slate-900 bg-slate-100" : "text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <UsersRound className="w-4 h-4 shrink-0" />
                    <span>Resurser</span>
                  </button>

                  <button
                    onClick={() => {
                      setActiveTab2("budget");
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full px-5 py-3 text-left font-bold text-xs flex items-center gap-3 transition cursor-pointer ${
                      activeTab === "budget" ? "text-slate-900 bg-slate-100" : "text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <DollarSign className="w-4 h-4 shrink-0" />
                    <span>Økonomi & Budget</span>
                  </button>

                  <button
                    onClick={() => {
                      setActiveTab2("settings");
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full px-5 py-3 text-left font-bold text-xs flex items-center gap-3 transition cursor-pointer ${
                      activeTab === "settings" ? "text-slate-900 bg-slate-100" : "text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <SettingsIcon className="w-4 h-4 shrink-0" />
                    <span>Projekt & Kalender</span>
                  </button>

                  <button
                    onClick={() => {
                      setActiveTab2("glossary");
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full px-5 py-3 text-left font-bold text-xs flex items-center gap-3 transition cursor-pointer ${
                      activeTab === "glossary" ? "text-slate-900 bg-slate-100" : "text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <HelpCircle className="w-4 h-4 shrink-0" />
                    <span>Vidensbase (?)</span>
                  </button>
                </div>
              )}
          </div>

          {/* Desktop Tab Selector Bar (hidden on mobile, visible on sm and up) */}
          <div className="hidden sm:flex border-b border-slate-200 overflow-x-auto pb-px scrollbar-hide gap-1 max-w-full">
            <button
              onClick={() => setActiveTab2("tidsplan")}
              className={`px-2.5 sm:px-4 py-2 sm:py-3 font-semibold text-[10px] sm:text-xs flex flex-col sm:flex-row items-center gap-1 sm:gap-1.5 cursor-pointer whitespace-nowrap transition-all border-b-2 min-h-[48px] sm:min-h-[44px] flex-1 sm:flex-initial ${
                activeTab === "tidsplan"
                  ? "border-slate-800 text-slate-900 bg-white rounded-t-lg font-black"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              <CalendarDays className="w-5 h-5 sm:w-4 sm:h-4 shrink-0 text-slate-500 group-hover:text-slate-800" />
              <span>Tidsplan ({appState.tasks.length})</span>
            </button>

            <button
              onClick={() => setActiveTab2("resources")}
              className={`px-2.5 sm:px-4 py-2 sm:py-3 font-semibold text-[10px] sm:text-xs flex flex-col sm:flex-row items-center gap-1 sm:gap-1.5 cursor-pointer whitespace-nowrap transition-all border-b-2 min-h-[48px] sm:min-h-[44px] flex-1 sm:flex-initial ${
                activeTab === "resources"
                  ? "border-slate-800 text-slate-900 bg-white rounded-t-lg font-black"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              <UsersRound className="w-5 h-5 sm:w-4 sm:h-4 shrink-0 text-slate-500 group-hover:text-slate-800" />
              <span>Resurser</span>
            </button>

            <button
              onClick={() => setActiveTab2("budget")}
              className={`px-2.5 sm:px-4 py-2 sm:py-3 font-semibold text-[10px] sm:text-xs flex flex-col sm:flex-row items-center gap-1 sm:gap-1.5 cursor-pointer whitespace-nowrap transition-all border-b-2 min-h-[48px] sm:min-h-[44px] flex-1 sm:flex-initial ${
                activeTab === "budget"
                  ? "border-slate-800 text-slate-900 bg-white rounded-t-lg font-black"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              <DollarSign className="w-5 h-5 sm:w-4 sm:h-4 shrink-0 text-slate-500 group-hover:text-slate-800" />
              <span>Økonomi</span>
            </button>

            <button
              onClick={() => setActiveTab2("settings")}
              className={`px-2.5 sm:px-4 py-2 sm:py-3 font-semibold text-[10px] sm:text-xs flex flex-col sm:flex-row items-center gap-1 sm:gap-1.5 cursor-pointer whitespace-nowrap transition-all border-b-2 min-h-[48px] sm:min-h-[44px] flex-1 sm:flex-initial ${
                activeTab === "settings"
                  ? "border-slate-800 text-slate-900 bg-white rounded-t-lg font-black"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              <SettingsIcon className="w-5 h-5 sm:w-4 sm:h-4 shrink-0 text-slate-500 group-hover:text-slate-800" />
              <span>Indstillinger</span>
            </button>

            <button
              onClick={() => setActiveTab2("glossary")}
              className={`px-3 py-2 sm:py-3 flex items-center justify-center cursor-pointer transition-all border-b-2 min-h-[48px] sm:min-h-[44px] ${
                activeTab === "glossary"
                  ? "border-slate-800 text-slate-900 bg-white rounded-t-lg font-black bg-slate-50"
                  : "border-transparent text-slate-450 hover:text-slate-800"
              }`}
              title="Vidensbase (?)"
            >
              <HelpCircle className="w-5 h-5 sm:w-4 sm:h-4 shrink-0" />
            </button>
          </div>
        </div>

        {/* Tab layouts with fast simple state selectors */}
        <div className="flex-1 w-full overflow-hidden">
          {/* TAP 1: Combined Tidsplan & Gantt Chart Layout */}
          {activeTab === "tidsplan" && (
            <div className="flex flex-col gap-4">
              {/* Inner Sub-navigation toggle */}
              <div className="flex bg-slate-100/80 p-1.5 rounded-xl self-start max-w-full border border-slate-200/50 shadow-3xs select-none">
                <button
                  type="button"
                  onClick={() => setTidsplanView("gantt")}
                  className={`flex items-center gap-2 px-4 py-2 text-xs font-black transition-all cursor-pointer rounded-lg ${
                    tidsplanView === "gantt"
                      ? "bg-white text-slate-900 shadow-xs"
                      : "text-slate-500 hover:text-slate-800 hover:bg-white/40"
                  }`}
                >
                  <CalendarDays className="w-4 h-4 text-slate-600" />
                  <span>Gantt</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTidsplanView("list")}
                  className={`flex items-center gap-2 px-4 py-2 text-xs font-black transition-all cursor-pointer rounded-lg ${
                    tidsplanView === "list"
                      ? "bg-white text-slate-900 shadow-xs"
                      : "text-slate-500 hover:text-slate-800 hover:bg-white/40"
                  }`}
                >
                  <ListChecks className="w-4 h-4 text-slate-600" />
                  <span>Opgaver ({appState.tasks.length})</span>
                </button>
              </div>

              {/* View Rendering based on selected view mode */}
              <div className="w-full">
                {tidsplanView === "list" ? (
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 md:gap-6">
                    {/* Task Forms Component */}
                    <div className="lg:col-span-5 flex flex-col gap-4">
                      <TaskForm
                        tasks={appState.tasks}
                        trades={appState.trades}
                        stages={appState.stages || []}
                        editTaskId={editTaskId}
                        onSave={(t) => {
                          handleSaveTask(t);
                        }}
                        onCancel={() => setEditTaskId(null)}
                      />
                      
                      {/* Visual info card inside task view */}
                      <div className="bg-slate-100/60 border border-slate-200 rounded-xl p-4 flex gap-3 text-xs leading-relaxed select-none">
                        <span className="text-lg shrink-0">💡</span>
                        <div>
                          <span className="font-extrabold text-slate-700 block mb-0.5">Automatisk beregning</span>
                          <p className="text-slate-500 font-medium">
                            Hver gang du opretter eller ændrer en dagsplan, justeres overenskomstmæssige weekendtillæg, ferielønninger og tidsbjælker øjeblikkeligt!
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Scheduled Tasks List Panel representing Opgaver */}
                    <div className="lg:col-span-7 flex flex-col gap-3">
                      <h3 className="text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 px-1">
                        Oprettede opgaver ({appState.tasks.length})
                      </h3>

                      {appState.tasks.length === 0 ? (
                        <div className="bg-white border border-dashed border-slate-200 p-8 md:p-12 text-center rounded-xl text-xs text-slate-400 flex flex-col items-center justify-center">
                          <ListChecks className="w-10 h-10 text-slate-200 mb-2" />
                          <p className="font-semibold text-slate-500">Intet planlagt endnu</p>
                          <p className="text-[10px] text-slate-400 mt-1 max-w-xs leading-relaxed">
                            Brug formularen til venstre og giv opgaven faggrupper og varighed for at se dem her.
                          </p>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-3">
                          {calculatedTasks.map((t, tIdx) => (
                            <TaskCard
                              key={t.id}
                              task={t}
                              number={tIdx + 1}
                              stageById={stageById}
                              tradeById={tradeById}
                              onEdit={setEditTaskId}
                              onDelete={handleDeleteTask}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="bg-white border border-slate-200 p-3 md:p-5 rounded-2xl shadow-xs">
                    <div className="flex flex-wrap items-center justify-between gap-3 mb-4 px-1">
                      <div>
                        <h3 className="text-sm md:text-base font-black text-slate-800 tracking-tight select-none flex items-center gap-1.5 leading-none">
                          <CalendarDays className="w-5 h-5 text-slate-700" />
                          <span>Tidsplan & Gantt-diagram</span>
                        </h3>
                        <p className="text-[10px] text-slate-400 font-semibold mt-1 leading-normal">
                          Træk i midten for at forskyde opgaverne på den rigtige rækkefølge eller træk højre kant for at ændre varigheden.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setEditTaskId(null);
                          setTidsplanView("list");
                        }}
                        className="bg-slate-900 active:bg-black hover:bg-black text-white font-black text-[10px] md:text-xs py-2 px-3 rounded-lg cursor-pointer transition select-none flex items-center gap-1 shadow-xs min-h-[34px]"
                      >
                        <PlusCircle className="w-3.5 h-3.5" />
                        <span>Opret ny opgave</span>
                      </button>
                    </div>

                    <GanttChart
                      tasks={calculatedTasks}
                      trades={appState.trades}
                      holidays={appState.holidays}
                      projectStartDate={appState.startDate}
                      stages={appState.stages || []}
                      weatherDelays={appState.weatherDelays || []}
                      onUpdateTasks={(ts) => setAppState((p) => ({ ...p, tasks: ts }))}
                      onEditTask={(task) => {
                        setEditTaskId(task.id);
                        setTidsplanView("list");
                      }}
                      onAddHoliday={handleAddHoliday}
                      onDeleteHoliday={handleDeleteHoliday}
                      onAddWeatherDelay={handleAddWeatherDelay}
                      onDeleteWeatherDelay={handleDeleteWeatherDelay}
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAP 3: Resources & Worker groups */}
          {activeTab === "resources" && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 md:gap-6">
              {/* Add resource form */}
              <div className="lg:col-span-5 flex flex-col gap-4">
                <TradeForm
                  trades={appState.trades}
                  editTradeId={editTradeId}
                  onSave={(tr) => {
                    handleSaveTrade(tr);
                  }}
                  onCancel={() => setEditTradeId(null)}
                />
              </div>

              {/* Workers list */}
              <div className="lg:col-span-7 flex flex-col gap-3">
                <h3 className="text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 px-1">
                  Aktive faggrupper ({appState.trades.length})
                </h3>

                {appState.trades.length === 0 ? (
                  <div className="bg-white border border-dashed border-slate-200 p-8 md:p-12 text-center rounded-xl text-xs text-slate-400 flex flex-col items-center justify-center">
                    <UsersRound className="w-10 h-10 text-slate-200 mb-2" />
                    <p className="font-semibold text-slate-500">Ingen faggrupper oprettet</p>
                    <p className="text-[10px] text-slate-400 mt-1 select-none">
                      Opret dem til venstre, for at tildele dem dine arbejdsopgaver.
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {appState.trades.map((tr) => {
                      const stats = tradeStats[tr.id] || { cost: 0, count: 0 };
                      return (
                        <div
                          key={tr.id}
                          className="bg-white border border-slate-250 p-3 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span
                              className="w-3.5 h-3.5 rounded-full ring-2 ring-slate-100 shrink-0"
                              style={{ backgroundColor: tr.color }}
                            />
                            <div className="min-w-0">
                              <h4 className="text-xs font-extrabold text-slate-700 leading-none truncate">{tr.name}</h4>
                              <span className="text-[10px] text-slate-400 font-bold block mt-1.5 leading-tight">
                                {tr.isFixedPrice ? (
                                  <span>Fast kontraktkontrakt: {tr.rate.toLocaleString("da-DK")} kr.</span>
                                ) : (
                                  <span>
                                    Takst: {tr.rate} kr/t • Weekend: +{tr.weekendSupplement}% • Ferie: +{tr.holidaySupplement}%
                                  </span>
                                )}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center justify-between sm:justify-end gap-3 border-t sm:border-t-0 border-slate-100 pt-2 sm:pt-0">
                            <div className="text-right">
                              <span className="text-[9px] md:text-[10px] bg-slate-100 px-2 py-0.5 rounded font-extrabold text-slate-600 block">
                                {stats.count} {stats.count === 1 ? "opgave" : "opgaver"}
                              </span>
                            </div>

                            <div className="flex gap-1.5">
                              <button
                                onClick={() => setEditTradeId(tr.id)}
                                className="p-2 bg-slate-50 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer border-0 transition min-w-[34px] min-h-[34px] flex items-center justify-center"
                                title="Rediger"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteTrade(tr.id)}
                                className="p-2 bg-red-50 hover:bg-red-100 text-red-400 hover:text-red-700 rounded-lg cursor-pointer border-0 transition min-w-[34px] min-h-[34px] flex items-center justify-center"
                                title="Slet"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAP 4: Budget & PDF report */}
          {activeTab === "budget" && (
            <div className="bg-white border border-slate-200 rounded-2xl p-4 md:p-5 shadow-xs flex flex-col gap-4 md:gap-5 select-none print:shadow-none print:border-none print:p-0">
              <div className="flex justify-between items-center border-b border-slate-100 pb-3 print:hidden gap-2">
                <h3 className="text-xs md:text-sm font-black text-slate-800 tracking-tight flex items-center gap-1.5">
                  <DollarSign className="w-4 h-4 text-slate-700" />
                  <span>Finansielt overblik & Sagspris</span>
                </h3>
                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-1 text-[10px] md:text-xs font-extrabold text-slate-600 hover:text-slate-850 bg-slate-50 border border-slate-200 px-3 py-2 rounded-lg cursor-pointer hover:bg-slate-100 active:scale-95 transition shadow-2xs select-none min-h-[36px]"
                  title="Gem eller udskriv rapport"
                >
                  <Printer className="w-4 h-4" />
                  <span>Download PDF-rapport</span>
                </button>
              </div>

              {/* Printable header box */}
              <div className="hidden print:flex flex-col gap-1 mb-6">
                <span className="text-xs uppercase font-extrabold tracking-wider text-slate-400 leading-none">
                  Firma- og Sagsafleveringsrapport
                </span>
                <h2 className="text-2xl font-black text-slate-800 tracking-tight leading-none">MD Project Budget</h2>
                <div className="text-[10px] text-slate-400 mt-1 font-bold">
                  Udskrevet: {new Date().toLocaleDateString("da-DK")}
                </div>
              </div>

              {/* Overall total cost meter */}
              <div className="p-4 md:p-6 bg-emerald-50 rounded-2xl border border-emerald-100/55 text-center flex flex-col items-center">
                <span className="text-[9px] md:text-[10px] uppercase font-bold text-slate-400 tracking-wider">Total sagspris</span>
                <span className="text-xl md:text-3xl font-black text-emerald-800 tracking-tight mt-1 font-mono">
                  {projectTotalCost.toLocaleString("da-DK")} kr.
                </span>
                <div className="text-[11px] md:text-xs text-slate-500 font-bold mt-1 max-w-sm">
                  Planlagt deadline:{" "}
                  <span className="text-slate-800 font-black">
                    {projectEndDate ? new Date(`${projectEndDate}T12:00:00`).toLocaleDateString("da-DK", { day: "numeric", month: "long", year: "numeric" }) : "Ingen"}
                  </span>
                </div>
              </div>

              {/* Breakdown lists split */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-6 mt-1">
                {/* 1. Cost per trade */}
                <div className="flex flex-col gap-2.5">
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100 pb-1 flex items-center gap-1">
                    <span>👷</span>
                    <span>Udgifter pr faggruppe</span>
                  </h4>
                  <div className="flex flex-col gap-2">
                    {appState.trades.map((tr) => {
                      const stats = tradeStats[tr.id] || { cost: 0, count: 0 };
                      return (
                        <div
                          key={tr.id}
                          className="flex justify-between items-center text-xs p-2.5 bg-slate-50 rounded-xl border border-slate-200"
                        >
                          <span className="flex items-center gap-1.5 font-bold text-slate-750 truncate max-w-[65%]">
                            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: tr.color }} />
                            <span className="truncate">{tr.name}</span>
                          </span>
                          <span className="font-extrabold text-slate-800 font-mono shrink-0">
                            {stats.cost.toLocaleString("da-DK")} kr.
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 2. Cost per task */}
                <div className="flex flex-col gap-2.5">
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100 pb-1 flex items-center gap-1">
                    <span>📋</span>
                    <span>Udgifter pr opgave</span>
                  </h4>
                  <div className="flex flex-col gap-2 max-h-[260px] overflow-y-auto">
                    {calculatedTasks.map((t) => (
                      <div
                        key={t.id}
                        className="flex justify-between items-center text-xs p-2.5 bg-slate-50 rounded-xl border border-slate-200"
                      >
                        <span className="font-semibold text-slate-700 truncate max-w-[65%]">{t.title}</span>
                        <span className="font-extrabold text-slate-800 font-mono shrink-0">
                          {(t.calcCost || 0).toLocaleString("da-DK")} kr.
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAP 5: Config Settings */}
          {activeTab === "settings" && (
            <ProjectSettings
              startDate={appState.startDate}
              settings={appState.settings}
              projectInfo={appState.projectInfo}
              holidays={appState.holidays}
              stages={appState.stages || []}
              weatherDelays={appState.weatherDelays || []}
              onUpdateStartDate={handleUpdateStartDate}
              onUpdateWorkHours={handleUpdateWorkHours}
              onUpdateProjectInfo={handleUpdateProjectInfo}
              onAddHoliday={handleAddHoliday}
              onDeleteHoliday={handleDeleteHoliday}
              onAddStage={handleAddStage}
              onDeleteStage={handleDeleteStage}
              onAddWeatherDelay={handleAddWeatherDelay}
              onDeleteWeatherDelay={handleDeleteWeatherDelay}
            />
          )}

          {/* TAP 6: Glossary / Vidensbase */}
          {activeTab === "glossary" && (
            <div className="bg-white border border-slate-200 p-4 md:p-6 rounded-2xl shadow-xs">
              <Suspense fallback={null}>
                <Glossary onTriggerWizard={() => setWizardOpen(true)} />
              </Suspense>
            </div>
          )}
        </div>
      </main>

      {/* Minimalistisk Footer */}
      <footer className="bg-slate-50 border-t border-slate-200/60 py-4 text-center text-xs text-slate-400 select-none print:hidden">
        <p className="font-medium">
          Udviklet af{" "}
          <a
            href="https://www.marcdahl.dk"
            target="_blank"
            rel="noopener noreferrer"
            className="text-slate-500 hover:text-slate-800 font-extrabold hover:underline transition"
          >
            Marc Sonne Dahl
          </a>
        </p>
      </footer>

      {/* Projekt-guide / Wizard (loaded only when needed) */}
      {wizardOpen && (
        <Suspense fallback={null}>
          <Wizard isOpen={wizardOpen} onComplete={handleWizardComplete} />
        </Suspense>
      )}

      {/* Persistent slide-up toast notification panel */}
      {toastMsg && (
        <div className="animate-toast-in fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-900 border border-slate-800 text-white rounded-xl px-4 py-3 text-xs font-bold flex items-center gap-2 shadow-lg z-50 select-none pointer-events-none">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          <span>{toastMsg}</span>
        </div>
      )}
    </div>
  );
}
