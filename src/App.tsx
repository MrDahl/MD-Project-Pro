import { weekdayAverageHours } from "./utils/worktime";
import { ResourceReport } from "./components/ResourceReport";
import { applyBulk, deleteMany, type BulkChange } from "./utils/bulk";
import React, { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Task, Trade, Settings, ProjectInfo, Stage, Holiday, WeekSchedule } from "./types";
import { calculateSchedule } from "./utils/scheduler";
import { danishHolidays, projectYears } from "./utils/holidays";
import { findWarnings } from "./utils/warnings";
import { duplicateTask } from "./utils/taskFilter";
import { hasLinkTo, removeLinksTo } from "./utils/links";
import { daysBetween, makeBaseline } from "./utils/baseline";
import { buildTemplate } from "./data/templates";
import { nextMonday } from "./utils/dates";
import { CostCurve } from "./components/CostCurve";
import { indexBy } from "./components/gantt/model";
import { GanttChart } from "./components/gantt/GanttChart";
import { TaskList } from "./components/TaskList";
import { TaskDrawer } from "./components/TaskDrawer";
import { WarningsPanel } from "./components/WarningsPanel";
import { TradeForm } from "./components/TradeForm";
import { ProjectSettings } from "./components/ProjectSettings";
import { AppHeader } from "./components/AppHeader";
import { Toast, ToastData } from "./components/Toast";
import { NewProjectDialog } from "./components/NewProjectDialog";
import { useProject } from "./state/useProject";
import { BACKUP_KEY, WIZARD_KEY, looksLikeProject, normalizeProject, readNumber, writeFlag } from "./state/project";
import { GOTO_TAB_EVENT } from "./components/HelpTip";
import { EmptyState } from "./components/EmptyState";
import { ContextMenu, type ContextMenuState } from "./components/ContextMenu";
import { CommandPalette, type PaletteItem } from "./components/CommandPalette";
import { Printer, Trash2, ListChecks, CalendarDays, UsersRound, DollarSign, Settings as SettingsIcon, Info, XCircle, Pencil, PlusCircle, HelpCircle, FolderKanban, Menu, X, HardHat, ClipboardList } from "lucide-react";

// Rarely used views are loaded on demand to keep the first load small
const Glossary = lazy(() => import("./components/Glossary").then((m) => ({ default: m.Glossary })));
const TaskForm = lazy(() => import("./components/TaskForm").then((m) => ({ default: m.TaskForm })));
const Wizard = lazy(() => import("./components/Wizard").then((m) => ({ default: m.Wizard })));

type TabId = "tidsplan" | "resources" | "budget" | "settings" | "glossary";

const TABS: { id: TabId; label: string; Icon: typeof CalendarDays }[] = [
  { id: "tidsplan", label: "Tidsplan", Icon: CalendarDays },
  { id: "resources", label: "Faggrupper", Icon: UsersRound },
  { id: "budget", label: "Økonomi", Icon: DollarSign },
  { id: "settings", label: "Projekt & kalender", Icon: SettingsIcon },
  { id: "glossary", label: "Vidensbase", Icon: HelpCircle },
];

const BACKUP_INTERVAL_MS = 7 * 24 * 3600 * 1000;

/** True when the user is typing in a field, where Ctrl+Z must keep its native text-undo meaning. */
function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  return el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable;
}

const UI_KEY = "mdppUi";
const TAB_IDS: TabId[] = ["tidsplan", "resources", "budget", "settings", "glossary"];
function loadUi(): { tab?: TabId; view?: "gantt" | "list"; dark?: boolean } {
  try {
    const raw = JSON.parse(localStorage.getItem(UI_KEY) || "{}");
    return {
      tab: TAB_IDS.includes(raw.tab) ? raw.tab : undefined,
      view: raw.view === "list" || raw.view === "gantt" ? raw.view : undefined,
      dark: raw.dark === true,
    };
  } catch {
    return {};
  }
}

export default function App() {
  const [activeTab, setActiveTab2] = useState<TabId>(() => loadUi().tab ?? "tidsplan");
  const [tidsplanView, setTidsplanView] = useState<"gantt" | "list">(() => loadUi().view ?? "gantt");
  const [dark, setDark] = useState<boolean>(() => loadUi().dark ?? false);
  const [menu, setMenu] = useState<ContextMenuState | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    try {
      localStorage.setItem(UI_KEY, JSON.stringify({ tab: activeTab, view: tidsplanView, dark }));
    } catch {
      /* storage unavailable */
    }
  }, [activeTab, tidsplanView, dark]);
  useEffect(() => {
    const go = (e: Event) => {
      const id = (e as CustomEvent).detail;
      if (TAB_IDS.includes(id)) setActiveTab2(id);
    };
    window.addEventListener(GOTO_TAB_EVENT, go);
    return () => window.removeEventListener(GOTO_TAB_EVENT, go);
  }, []);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  // On phones the Gantt chart is too cramped: show the task list (with dates) instead
  const [isPhone, setIsPhone] = useState(() => typeof window !== "undefined" && window.matchMedia("(max-width: 639px)").matches);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    const on = () => setIsPhone(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  const [wizardOpen, setWizardOpen] = useState(() => {
    // The guide opens automatically on the very first visit
    try {
      return !localStorage.getItem(WIZARD_KEY);
    } catch {
      return true;
    }
  });
  const [wizardCancelable, setWizardCancelable] = useState(false);
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [lastBackup, setLastBackup] = useState<number | null>(() => readNumber(BACKUP_KEY));

  const { state: appState, update, undo, redo, canUndo, canRedo, saveInfo } = useProject();
  const stateRef = useRef(appState);
  stateRef.current = appState;

  // Side panel for creating/editing a task (taskId null = new task)
  const [drawer, setDrawer] = useState<{ taskId: string | null } | null>(null);
  const editTaskId = drawer?.taskId ?? null;
  const [editTradeId, setEditTradeId] = useState<string | null>(null);

  // --- Notifications (optionally with an "undo" button) ---
  const [toast, setToast] = useState<ToastData | null>(null);
  const toastTimer = useRef<number | undefined>(undefined);
  const dismissToast = useCallback(() => {
    window.clearTimeout(toastTimer.current);
    setToast(null);
  }, []);
  const showToast = useCallback((message: string, withUndo = false) => {
    window.clearTimeout(toastTimer.current);
    setToast({ id: Date.now(), message, ...(withUndo ? { actionLabel: "Fortryd", onAction: undo } : {}) });
    toastTimer.current = window.setTimeout(() => setToast(null), withUndo ? 7000 : 3500);
  }, [undo]);

  // Ctrl/Cmd+Z = undo, Ctrl/Cmd+Shift+Z or Ctrl+Y = redo (not while typing in a field)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
        return;
      }
      if (!(e.ctrlKey || e.metaKey) || isTypingTarget(e.target)) return;
      const key = e.key.toLowerCase();
      if (key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if ((key === "z" && e.shiftKey) || key === "y") {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo]);

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
      danishHolidays(year).forEach((fH, fIdx) => {
        if (!formattedHolidays.some((h) => h.date === fH.date)) {
          formattedHolidays.push({ id: `hol-wiz-den-${fIdx}-${Date.now()}`, date: fH.date, name: fH.name });
        }
      });
    }
    formattedHolidays.sort((a, b) => a.date.localeCompare(b.date));

    const replacing = stateRef.current.tasks.length > 0 || stateRef.current.trades.length > 0;
    update({
      startDate: completedData.startDate,
      settings: completedData.settings,
      projectInfo: completedData.projectInfo,
      holidays: formattedHolidays,
      trades: completedData.trades,
      stages: completedData.stages,
      tasks: [],
      weatherDelays: [],
      scheduleError: null,
      startDateWarning: null,
    });
    writeFlag(WIZARD_KEY, "true");
    setWizardOpen(false);
    setWizardCancelable(false);
    setDrawer(null);
    setEditTradeId(null);
    setActiveTab2("tidsplan");
    showToast(replacing ? "Nyt projekt oprettet." : "Velkommen! Dit nye projekt er konfigureret med lukkedage.", replacing);
  };

  // The schedule is derived data: recalculated only when something it depends on changes
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

  // Keep Danish public holidays present for every calendar year the project touches (automatic: no undo step)
  useEffect(() => {
    const missingYears = projectYears(appState.startDate, projectEndDate).filter(
      (y) => !appState.holidays.some((h) => h.date.startsWith(String(y)))
    );
    if (missingYears.length === 0) return;

    update(
      (p) => {
        const known = new Set(p.holidays.map((h) => h.date));
        const added = missingYears
          .flatMap((y) => danishHolidays(y))
          .filter((h) => !known.has(h.date))
          .map((h) => ({ id: `hol-auto-${h.date}`, date: h.date, name: h.name }));
        if (added.length === 0) return p;
        return { ...p, holidays: [...p.holidays, ...added].sort((a, b) => a.date.localeCompare(b.date)) };
      },
      { history: false }
    );
  }, [appState.startDate, appState.holidays, projectEndDate, update]);

  // Task CRUD operations
  const handleSaveTask = (taskPayload: Omit<Task, "calcStart" | "calcEnd" | "calcCost" | "isCritical" | "tradeCosts" | "assignmentCosts" | "roleCosts" | "roleHours" | "calcStartMin" | "calcEndMin" | "calcHours">) => {
    if (editTaskId) {
      update((p) => ({ ...p, tasks: p.tasks.map((t) => (t.id === editTaskId ? { ...t, ...taskPayload } : t)) }));
      showToast("Opgaven er opdateret i tidsplanen.", true);
    } else {
      update((p) => ({ ...p, tasks: [...p.tasks, { ...taskPayload }] }));
      showToast("Ny opgave oprettet.", true);
    }
    setDrawer(null);
  };

  const handleDuplicateTask = useCallback(
    (id: string) => {
      const source = stateRef.current.tasks.find((t) => t.id === id);
      if (!source) return;
      const copy = duplicateTask(source, `task-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`);
      update((p) => {
        const idx = p.tasks.findIndex((t) => t.id === id);
        const tasks = p.tasks.slice();
        tasks.splice(idx + 1, 0, copy);
        return { ...p, tasks };
      });
      showToast(`"${copy.title}" er oprettet.`, true);
    },
    [update, showToast]
  );

  const handleBulkApply = useCallback(
    (ids: string[], change: BulkChange) => {
      const set = new Set(ids);
      update((p) => ({ ...p, tasks: applyBulk(p.tasks, set, change) }));
      showToast(`${ids.length} opgaver er opdateret.`, true);
    },
    [update, showToast]
  );

  const handleBulkDelete = useCallback(
    (ids: string[]) => {
      const set = new Set(ids);
      update((p) => ({ ...p, tasks: deleteMany(p.tasks, set) }));
      showToast(`${ids.length} opgaver er slettet. Brug Fortryd hvis det var en fejl.`, true);
    },
    [update, showToast]
  );

  const warnings = useMemo(
    () => findWarnings(calculatedTasks, appState.trades, appState.stages || []),
    [calculatedTasks, appState.trades, appState.stages]
  );

  const handleDeleteTask = useCallback(
    (id: string) => {
      const hasSuccessors = stateRef.current.tasks.some((t) => hasLinkTo(t, id));
      update((p) => ({
        ...p,
        tasks: p.tasks.filter((t) => t.id !== id).map((t) => removeLinksTo(t, id)),
      }));
      showToast(hasSuccessors ? "Opgaven er slettet - afhængige opgaver er gjort uafhængige." : "Opgaven er slettet.", true);
    },
    [update, showToast]
  );

  // Right-click on a task bar, label or card opens a small menu
  useEffect(() => {
    const onCtx = (e: MouseEvent) => {
      const el = (e.target as HTMLElement | null)?.closest<HTMLElement>("[data-task-id]");
      const id = el?.dataset.taskId;
      const task = id ? stateRef.current.tasks.find((t) => t.id === id) : undefined;
      if (!task) return;
      e.preventDefault();
      setMenu({ x: e.clientX, y: e.clientY, taskId: task.id, title: task.title });
    };
    document.addEventListener("contextmenu", onCtx);
    return () => document.removeEventListener("contextmenu", onCtx);
  }, []);

  const paletteItems = useMemo<PaletteItem[]>(
    () => [
      ...TABS.map((t) => ({ id: t.id, label: t.label, hint: "Fane", kind: "tab" as const })),
      ...calculatedTasks.map((t) => ({
        id: t.id,
        label: t.title,
        hint: t.calcStart ? new Date(`${t.calcStart}T12:00:00`).toLocaleDateString("da-DK", { day: "numeric", month: "short" }) : "Opgave",
        kind: "task" as const,
      })),
    ],
    [calculatedTasks]
  );

  // Trade CRUD operations
  const handleSaveTrade = (tradePayload: Trade) => {
    if (editTradeId) {
      update((p) => ({ ...p, trades: p.trades.map((tr) => (tr.id === editTradeId ? { ...tr, ...tradePayload } : tr)) }));
      setEditTradeId(null);
      showToast("Faggruppen er opdateret.", true);
    } else {
      update((p) => ({ ...p, trades: [...p.trades, { ...tradePayload }] }));
      showToast("Faggruppe tilføjet.", true);
    }
  };

  const handleDeleteTrade = (id: string) => {
    if (appState.tasks.some((t) => t.tradeIds?.includes(id))) {
      showToast("Faggruppen bruges af opgaver i tidsplanen. Fjern den fra opgaverne først.");
      return;
    }
    update((p) => ({ ...p, trades: p.trades.filter((tr) => tr.id !== id) }));
    showToast("Faggruppen er slettet.", true);
  };

  const handleAddStage = (newStage: Stage) => {
    update((p) => ({ ...p, stages: [...(p.stages || []), newStage] }));
    showToast(`Etape "${newStage.name}" er oprettet.`, true);
  };

  const handleDeleteStage = (id: string) => {
    update((p) => ({
      ...p,
      stages: (p.stages || []).filter((stg) => stg.id !== id),
      tasks: p.tasks.map((t) => {
        const inRecurring = t.recurringStageIds?.includes(id);
        if (t.stageId !== id && !inRecurring) return t;
        return {
          ...t,
          stageId: t.stageId === id ? null : t.stageId,
          recurringStageIds: inRecurring ? t.recurringStageIds!.filter((x) => x !== id) : t.recurringStageIds,
        };
      }),
    }));
    showToast("Etapen er slettet.", true);
  };

  const handleUpdateProjectInfo = (info: ProjectInfo) => update((p) => ({ ...p, projectInfo: info }), { coalesceKey: "info" });
  const handleUpdateStartDate = (date: string) => update((p) => ({ ...p, startDate: date }), { coalesceKey: "startDate" });
  const handleUpdateWorkHours = (hours: number) =>
    update((p) => ({ ...p, settings: { ...p.settings, workHoursPerDay: hours } }), { coalesceKey: "hours" });

  const handleUpdateWorkWeek = (week: WeekSchedule | undefined) =>
    update(
      (p) => {
        const settings = { ...p.settings };
        if (week) {
          settings.workWeek = week;
          const avg = weekdayAverageHours(week);
          if (avg > 0) settings.workHoursPerDay = Math.round(avg * 100) / 100;
        } else delete settings.workWeek;
        return { ...p, settings };
      },
      { coalesceKey: "workweek" }
    );

  const handleAddHoliday = (date: string, name: string = "Lukkedag") => {
    if (stateRef.current.holidays.some((h) => h.date === date)) return;
    const newHol: Holiday = {
      id: "hol-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6),
      date,
      name: name || "Lukkedag",
    };
    update((p) => ({ ...p, holidays: [...p.holidays, newHol] }));
    showToast(`Lukkedag "${name}" markeret i kalenderen.`, true);
  };

  const handleDeleteHoliday = (idx: number) => {
    update((p) => ({ ...p, holidays: p.holidays.filter((_, i) => i !== idx) }));
    showToast("Lukkedagen er fjernet.", true);
  };

  const handleAddWeatherDelay = (label: string, startDate: string, endDate: string) => {
    const newDelay = { id: "delay-" + Date.now(), label, startDate, endDate };
    update((p) => ({ ...p, weatherDelays: [...(p.weatherDelays || []), newDelay] }));
    showToast(`Vejrspildsdage "${label}" registreret.`, true);
  };

  const handleDeleteWeatherDelay = (id: string) => {
    update((p) => ({ ...p, weatherDelays: (p.weatherDelays || []).filter((wd) => wd.id !== id) }));
    showToast("Vejrspildsdagen er fjernet.", true);
  };

  // Full export/import operations (JSON file)
  const handleExportProject = useCallback(() => {
    const current = stateRef.current;
    const rawName = current.projectInfo?.projectName || "MD Project";
    const cleanName = rawName.trim().replace(/[^a-zA-Z0-9æøåÆØÅ\s-_]/g, "").replace(/\s+/g, "_");
    const filename = `${cleanName || "MD_Project"}.json`;

    const blob = new Blob([JSON.stringify(current, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);

    const now = Date.now();
    writeFlag(BACKUP_KEY, String(now));
    setLastBackup(now);
    showToast(`Projektfil gemt som ${filename}`);
  }, [showToast]);

  const handleImportProject = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (!looksLikeProject(parsed)) {
          showToast("Filen ligner ikke en MD Project-fil (opgaver eller faggrupper mangler).");
          return;
        }
        update(normalizeProject(parsed));
        setDrawer(null);
        setEditTradeId(null);
        showToast("Projektfilen er åbnet.", true);
      } catch {
        showToast("Filen kunne ikke læses. Er det en gyldig projektfil (.json)?");
      }
    };
    reader.readAsText(file);
  };

  const handleSaveBaseline = () => {
    const hadBaseline = !!stateRef.current.baseline;
    update((p) => ({ ...p, baseline: makeBaseline(calculatedTasks, projectEndDate, projectTotalCost) }));
    showToast(hadBaseline ? "Baseline er opdateret til den nuværende plan." : "Baseline gemt - afvigelser vises nu i Gantt og Økonomi.", true);
  };

  const handleClearBaseline = () => {
    update((p) => ({ ...p, baseline: null }));
    showToast("Baseline er fjernet.", true);
  };

  const startFromTemplate = (id: string) => {
    const data = buildTemplate(id, nextMonday());
    if (!data) return;
    const replacing = stateRef.current.tasks.length > 0 || stateRef.current.trades.length > 0;
    update(data);
    writeFlag(WIZARD_KEY, "true");
    setNewProjectOpen(false);
    setWizardOpen(false);
    setWizardCancelable(false);
    setDrawer(null);
    setEditTradeId(null);
    setActiveTab2("tidsplan");
    showToast(`Skabelonen "${data.projectInfo?.projectName}" er indlæst - tilpas den til dit projekt.`, replacing);
  };

  const startNewProject = () => {
    setNewProjectOpen(false);
    setWizardCancelable(true);
    setWizardOpen(true);
  };

  const hasContent = appState.tasks.length > 0 || appState.trades.length > 0;
  const backupDue = appState.tasks.length > 0 && (lastBackup === null || Date.now() - lastBackup > BACKUP_INTERVAL_MS);

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
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans antialiased">
      <AppHeader
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={undo}
        onRedo={redo}
        onNew={() => setNewProjectOpen(true)}
        onExport={handleExportProject}
        onImport={handleImportProject}
        savedAt={saveInfo.savedAt}
        saveFailed={saveInfo.failed}
        backupDue={backupDue}
        projectName={appState.projectInfo?.projectName || ""}
        endDate={projectEndDate}
        dark={dark}
        onToggleDark={() => setDark((d) => !d)}
        onSearch={() => setPaletteOpen(true)}
      />
      {menu && (
        <ContextMenu
          menu={menu}
          onEdit={(id) => setDrawer({ taskId: id })}
          onDuplicate={handleDuplicateTask}
          onDelete={handleDeleteTask}
          onClose={() => setMenu(null)}
        />
      )}
      {paletteOpen && (
        <CommandPalette
          items={paletteItems}
          onClose={() => setPaletteOpen(false)}
          onPick={(it) => {
            setPaletteOpen(false);
            if (it.kind === "tab") setActiveTab2(it.id as TabId);
            else setDrawer({ taskId: it.id });
          }}
        />
      )}

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
                <p className="text-xs md:text-xs text-slate-500 font-semibold mt-0.5 whitespace-normal leading-relaxed">
                  {appState.projectInfo.address}
                  {appState.projectInfo.customer ? ` • Kunde: ${appState.projectInfo.customer}` : ""}
                  {appState.projectInfo.manager ? ` • Ansvarlig: ${appState.projectInfo.manager}` : ""}
                </p>
              ) : (
                <p className="text-xs md:text-xs text-slate-450 font-semibold mt-0.5">
                  Projektdetaljer og planlægningsoverblik
                </p>
              )}
            </div>
          </div>
        </div>

        {/* High Density KPI Statistics Metrics */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 md:gap-3 print:hidden">
          <div className="bg-white border border-slate-200 rounded-xl p-3 flex flex-col justify-between shadow-2xs">
            <span className="text-xs md:text-xs font-black text-slate-500 block mb-1">Total Sagspris</span>
            <div className="flex items-baseline gap-0.5 md:gap-1 flex-wrap">
              <span className="text-sm md:text-lg font-black font-mono text-slate-900">{projectTotalCost.toLocaleString("da-DK")}</span>
              <span className="text-xs md:text-xs font-black text-slate-450 font-mono">kr.</span>
            </div>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-3 flex flex-col justify-between shadow-2xs">
            <span className="text-xs md:text-xs font-black text-slate-500 block mb-1">Færdiggørelsesdato</span>
            <div className="flex items-baseline gap-1">
              <span className="text-sm md:text-lg font-black text-slate-900 font-mono">
                {projectEndDate ? new Date(`${projectEndDate}T12:00:00`).toLocaleDateString("da-DK", { day: "numeric", month: "short" }) : "Ingen"}
              </span>
            </div>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-3 flex flex-col justify-between shadow-2xs">
            <span className="text-xs md:text-xs font-black text-slate-500 block mb-1">Opgaver</span>
            <div className="flex items-baseline gap-1">
              <span className="text-sm md:text-lg font-black text-slate-900 font-mono">{appState.tasks.length}</span>
              <span className="text-xs md:text-xs text-slate-500 font-mono font-black">stk.</span>
            </div>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-3 flex flex-col justify-between shadow-2xs">
            <span className="text-xs md:text-xs font-black text-slate-500 block mb-1">Faggrupper</span>
            <div className="flex items-baseline gap-1">
              <span className="text-sm md:text-lg font-black text-slate-900 font-mono">{appState.trades.length}</span>
              <span className="text-xs md:text-xs text-slate-500 font-mono font-black">stk.</span>
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

        {/* Tab navigation: dropdown on mobile, tab bar on larger screens */}
        <nav className="relative print:hidden" aria-label="Hovedmenu">
          <div className="sm:hidden flex flex-col border border-slate-200 rounded-xl bg-white overflow-hidden shadow-2xs">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-expanded={mobileMenuOpen}
              className="w-full px-4 py-3 flex items-center justify-between font-extrabold text-sm text-slate-800 bg-slate-50 hover:bg-slate-100/80 transition cursor-pointer"
            >
              <div className="flex items-center gap-2">
                {(() => {
                  const cur = TABS.find((t) => t.id === activeTab)!;
                  return (
                    <>
                      <cur.Icon className="w-5 h-5 text-slate-700" />
                      <span>{cur.label}{cur.id === "tidsplan" ? ` (${appState.tasks.length})` : ""}</span>
                    </>
                  );
                })()}
              </div>
              <div className="p-1 rounded-md hover:bg-slate-200 transition">
                {mobileMenuOpen ? <X className="w-5 h-5 text-slate-600" /> : <Menu className="w-5 h-5 text-slate-600" />}
              </div>
            </button>
            {mobileMenuOpen && (
              <div className="divide-y divide-slate-100 bg-white animate-menu-in">
                {TABS.map(({ id, label, Icon }) => (
                  <button
                    key={id}
                    onClick={() => {
                      setActiveTab2(id);
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full px-5 py-3 text-left font-bold text-xs flex items-center gap-3 transition cursor-pointer ${
                      activeTab === id ? "text-slate-900 bg-slate-100" : "text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{label}{id === "tidsplan" ? ` (${appState.tasks.length})` : ""}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="hidden sm:flex border-b border-slate-200 overflow-x-auto pb-px scrollbar-hide gap-1 max-w-full" role="tablist">
            {TABS.map(({ id, label, Icon }) => (
              <button
                key={id}
                role="tab"
                aria-selected={activeTab === id}
                onClick={() => setActiveTab2(id)}
                title={id === "glossary" ? "Vidensbase (?)" : undefined}
                className={`px-4 py-3 font-semibold text-xs flex items-center gap-1.5 cursor-pointer whitespace-nowrap transition-all border-b-2 min-h-[44px] ${
                  activeTab === id
                    ? "border-slate-800 text-slate-900 bg-white rounded-t-lg font-black"
                    : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                <Icon className="w-4 h-4 shrink-0 text-slate-500" />
                <span>{label}{id === "tidsplan" ? ` (${appState.tasks.length})` : ""}</span>
              </button>
            ))}
          </div>
        </nav>

        {/* Tab layouts with fast simple state selectors */}
        <div className="flex-1 w-full overflow-hidden">
          {/* TAP 1: Combined Tidsplan & Gantt Chart Layout */}
          {activeTab === "tidsplan" && (
            <div className="flex flex-col gap-4">
              <WarningsPanel warnings={warnings} onOpenTask={(id) => setDrawer({ taskId: id })} />


              {/* Inner Sub-navigation toggle */}
              <div className="flex bg-slate-100/80 p-1.5 rounded-xl self-start max-w-full border border-slate-200/50 shadow-3xs select-none">
                <button
                  type="button"
                  onClick={() => setTidsplanView("gantt")}
                  className={`hidden sm:flex items-center gap-2 px-4 py-2 text-xs font-black transition-all cursor-pointer rounded-lg ${
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
                {tidsplanView === "list" || isPhone ? (
                  <TaskList
                    tasks={calculatedTasks}
                    trades={appState.trades}
                    stages={appState.stages || []}
                    stageById={stageById}
                    tradeById={tradeById}
                    onNew={() => setDrawer({ taskId: null })}
                    onEdit={(id) => setDrawer({ taskId: id })}
                    onDelete={handleDeleteTask}
                    onDuplicate={handleDuplicateTask}
                    onBulkApply={handleBulkApply}
                    onBulkDelete={handleBulkDelete}
                  />
                ) : appState.tasks.length === 0 ? (
                  <EmptyState onTemplate={() => setNewProjectOpen(true)} onFirstTask={() => setDrawer({ taskId: null })} />
                ) : (
                  <div className="bg-white border border-slate-200 p-3 md:p-5 rounded-2xl shadow-xs">
                    <div className="flex flex-wrap items-center justify-between gap-3 mb-4 px-1">
                      <div>
                        <h3 className="text-sm md:text-base font-black text-slate-800 tracking-tight select-none flex items-center gap-1.5 leading-none">
                          <CalendarDays className="w-5 h-5 text-slate-700" />
                          <span>Tidsplan & Gantt-diagram</span>
                        </h3>
                        <p className="text-xs text-slate-500 font-semibold mt-1 leading-normal">
                          Træk i midten for at forskyde opgaverne på den rigtige rækkefølge eller træk højre kant for at ændre varigheden.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setDrawer({ taskId: null })}
                        className="bg-slate-900 active:bg-black hover:bg-black text-white font-black text-xs md:text-xs py-2 px-3 rounded-lg cursor-pointer transition select-none flex items-center gap-1 shadow-xs min-h-[34px]"
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
                      baseline={appState.baseline}
                      projectInfo={appState.projectInfo}
                      onSaveBaseline={handleSaveBaseline}
                      onClearBaseline={handleClearBaseline}
                      onUpdateTasks={(ts, newGesture) => update((p) => ({ ...p, tasks: ts }), { history: newGesture })}
                      onEditTask={(task) => setDrawer({ taskId: task.id })}
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
                <h3 className="text-xs md:text-xs font-bold text-slate-500 mb-1 px-1">
                  Aktive faggrupper ({appState.trades.length})
                </h3>

                {appState.trades.length === 0 ? (
                  <div className="bg-white border border-dashed border-slate-200 p-8 md:p-12 text-center rounded-xl text-xs text-slate-500 flex flex-col items-center justify-center">
                    <UsersRound className="w-10 h-10 text-slate-200 mb-2" />
                    <p className="font-semibold text-slate-500">Ingen faggrupper oprettet</p>
                    <p className="text-xs text-slate-500 mt-1 select-none">
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
                              <span className="text-xs text-slate-500 font-bold block mt-1.5 leading-tight">
                                {tr.isFixedPrice ? (
                                  <span>Fast kontraktkontrakt: {tr.rate.toLocaleString("da-DK")} kr.</span>
                                ) : (
                                  <span>
                                    Takst: {tr.rate} kr/t • Weekend: +{tr.weekendSupplement}% • Ferie: +{tr.holidaySupplement}%
                                  </span>
                                )}
                              </span>
                              {(tr.roles || []).length > 0 && (
                                <span data-testid="trade-roles" className="text-xs text-slate-500 font-semibold block mt-1 leading-tight">
                                  Hold: {(tr.roles || []).map((r) => `${r.count} ${r.name.toLowerCase()}`).join(", ")}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center justify-between sm:justify-end gap-3 border-t sm:border-t-0 border-slate-100 pt-2 sm:pt-0">
                            <div className="text-right">
                              <span className="text-xs md:text-xs bg-slate-100 px-2 py-0.5 rounded font-extrabold text-slate-600 block">
                                {stats.count} {stats.count === 1 ? "opgave" : "opgaver"}
                              </span>
                            </div>

                            <div className="flex gap-1.5">
                              <button
                                onClick={() => setEditTradeId(tr.id)}
                                className="p-2 bg-slate-50 hover:bg-slate-100 text-slate-500 hover:text-slate-600 rounded-lg cursor-pointer border-0 transition min-w-[34px] min-h-[34px] flex items-center justify-center"
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
            <div className="bg-white border border-slate-200 rounded-2xl p-4 md:p-5 shadow-xs flex flex-col gap-4 md:gap-5 print:shadow-none print:border-none print:p-0">
              <div className="flex justify-between items-center border-b border-slate-100 pb-3 print:hidden gap-2">
                <h3 className="text-xs md:text-sm font-black text-slate-800 tracking-tight flex items-center gap-1.5">
                  <DollarSign className="w-4 h-4 text-slate-700" />
                  <span>Finansielt overblik & Sagspris</span>
                </h3>
                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-1 text-xs md:text-xs font-extrabold text-slate-600 hover:text-slate-850 bg-slate-50 border border-slate-200 px-3 py-2 rounded-lg cursor-pointer hover:bg-slate-100 active:scale-95 transition shadow-2xs select-none min-h-[36px]"
                  title="Gem eller udskriv rapport"
                >
                  <Printer className="w-4 h-4" />
                  <span>Download PDF-rapport</span>
                </button>
              </div>

              {/* Printable header box */}
              <div className="hidden print:flex flex-col gap-1 mb-6">
                <span className="text-xs font-extrabold text-slate-500 leading-none">
                  Firma- og Sagsafleveringsrapport
                </span>
                <h2 className="text-2xl font-black text-slate-800 tracking-tight leading-none">MD Project Budget</h2>
                <div className="text-xs text-slate-500 mt-1 font-bold">
                  Udskrevet: {new Date().toLocaleDateString("da-DK")}
                </div>
              </div>

              {/* Overall total cost meter */}
              <div className="p-4 md:p-6 bg-emerald-50 rounded-2xl border border-emerald-100/55 text-center flex flex-col items-center">
                <span className="text-xs md:text-xs font-bold text-slate-500">Total sagspris</span>
                <span className="text-xl md:text-3xl font-black text-emerald-800 tracking-tight mt-1 font-mono">
                  {projectTotalCost.toLocaleString("da-DK")} kr.
                </span>
                <div className="text-xs md:text-xs text-slate-500 font-bold mt-1 max-w-sm">
                  Planlagt deadline:{" "}
                  <span className="text-slate-800 font-black">
                    {projectEndDate ? new Date(`${projectEndDate}T12:00:00`).toLocaleDateString("da-DK", { day: "numeric", month: "long", year: "numeric" }) : "Ingen"}
                  </span>
                </div>
              </div>

              {/* Baseline comparison */}
              {appState.baseline && (
                <div data-testid="baseline-summary" className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  {(() => {
                    const dDays = daysBetween(appState.baseline.endDate, projectEndDate);
                    const dCost = projectTotalCost - appState.baseline.totalCost;
                    const tone = (n: number) => (n > 0 ? "text-red-600" : n < 0 ? "text-emerald-600" : "text-slate-600");
                    return (
                      <>
                        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                          <span className="text-xs font-black text-slate-500 block mb-1">Slutdato mod baseline</span>
                          <span className={`font-black ${tone(dDays ?? 0)}`}>
                            {dDays === null ? "Ingen data" : dDays === 0 ? "Uændret" : `${dDays > 0 ? "+" : ""}${dDays} kalenderdage`}
                          </span>
                        </div>
                        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                          <span className="text-xs font-black text-slate-500 block mb-1">Sagspris mod baseline</span>
                          <span className={`font-black font-mono ${tone(dCost)}`}>
                            {dCost === 0 ? "Uændret" : `${dCost > 0 ? "+" : ""}${Math.round(dCost).toLocaleString("da-DK")} kr.`}
                          </span>
                        </div>
                      </>
                    );
                  })()}
                </div>
              )}

              {/* Accumulated cost over time */}
              <div className="flex flex-col gap-2">
                <h4 className="text-xs font-bold text-slate-500 border-b border-slate-100 pb-1">Omkostninger over tid (S-kurve)</h4>
                <CostCurve tasks={calculatedTasks} baseline={appState.baseline} />
              </div>

              <ResourceReport tasks={calculatedTasks} trades={appState.trades} stages={appState.stages || []} workHoursPerDay={appState.settings.workHoursPerDay} />

              {/* Breakdown lists split */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-6 mt-1">
                {/* 1. Cost per trade */}
                <div className="flex flex-col gap-2.5">
                  <h4 className="text-xs font-bold text-slate-500 border-b border-slate-100 pb-1 flex items-center gap-1">
                    <HardHat className="w-3.5 h-3.5 shrink-0" />
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
                  <h4 className="text-xs font-bold text-slate-500 border-b border-slate-100 pb-1 flex items-center gap-1">
                    <ClipboardList className="w-3.5 h-3.5 shrink-0" />
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
              onUpdateWorkWeek={handleUpdateWorkWeek}
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
      <footer className="bg-slate-50 border-t border-slate-200/60 py-4 text-center text-xs text-slate-500 select-none print:hidden">
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
          <Wizard
            isOpen={wizardOpen}
            onComplete={handleWizardComplete}
            onCancel={wizardCancelable ? () => { setWizardOpen(false); setWizardCancelable(false); } : undefined}
          />
        </Suspense>
      )}

      {drawer && (
        <TaskDrawer title={editTaskId ? "Rediger opgave" : "Ny opgave"} onClose={() => setDrawer(null)}>
          <Suspense fallback={<p className="text-xs text-slate-500">Indlæser…</p>}>
            <TaskForm
              hoursPerDay={appState.settings.workHoursPerDay}
              tasks={appState.tasks}
              trades={appState.trades}
              stages={appState.stages || []}
              editTaskId={editTaskId}
              hideHeading
              onSave={handleSaveTask}
              onCancel={() => setDrawer(null)}
            />
          </Suspense>
        </TaskDrawer>
      )}

      <NewProjectDialog
        open={newProjectOpen}
        hasContent={hasContent}
        onSaveFirst={() => {
          handleExportProject();
          startNewProject();
        }}
        onConfirm={startNewProject}
        onTemplate={startFromTemplate}
        onCancel={() => setNewProjectOpen(false)}
      />

      {saveInfo.failed && (
        <div className="fixed bottom-4 right-4 max-w-xs bg-red-600 text-white text-xs font-bold rounded-xl px-4 py-3 shadow-lg z-[55]">
          Browseren kan ikke gemme dit projekt automatisk. Tryk "Gem" for at downloade en projektfil.
        </div>
      )}

      <Toast toast={toast} onDismiss={dismissToast} />
    </div>
  );
}
