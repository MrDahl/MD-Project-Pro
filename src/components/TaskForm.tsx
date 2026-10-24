import React, { useState, useEffect } from "react";
import { Task, Trade, Stage, Dependency, Assignment } from "../types";
import { CrewEditor } from "./CrewEditor";
import { HelpTip } from "./HelpTip";
import { cleanAssignments } from "../utils/roles";
import { formatTime, parseTime } from "../utils/worktime";
import { descendantsOf, taskLinks } from "../utils/links";
import { Save, Ban, Calendar, Clock, Link, Check, Plus, RefreshCw, Layers, DollarSign, Trash2, ChevronDown } from "lucide-react";

interface TaskFormProps {
  tasks: Task[];
  trades: Trade[];
  stages: Stage[];
  editTaskId: string | null;
  onSave: (task: Omit<Task, "calcStart" | "calcEnd" | "calcCost" | "isCritical" | "tradeCosts" | "assignmentCosts" | "roleCosts" | "roleHours" | "calcStartMin" | "calcEndMin" | "calcHours">) => void;
  onCancel: () => void;
  /** Hide the form's own heading (when a surrounding panel already shows a title). */
  hideHeading?: boolean;
  /** Project hours per day, used to estimate the days of an hour-based task */
  hoursPerDay?: number;
}

export function TaskForm({ tasks, trades, stages, editTaskId, onSave, onCancel, hideHeading, hoursPerDay = 7.4 }: TaskFormProps) {
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [manualStart, setManualStart] = useState("");
  const [duration, setDuration] = useState<number>(3);
  const [unit, setUnit] = useState<"days" | "hours">("days");
  const [hours, setHours] = useState<number>(4);
  const [startTime, setStartTime] = useState("");
  const [selectedTradeIds, setSelectedTradeIds] = useState<string[]>([]);
  const [links, setLinks] = useState<Dependency[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [allowWeekend, setAllowWeekend] = useState(false);
  const [allowHoliday, setAllowHoliday] = useState(false);
  const [weatherIndependent, setWeatherIndependent] = useState(false);

  // Stage, Recurrence, Progress & Type additions
  const [stageId, setStageId] = useState("");
  const [isRecurring, setIsRecurring] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [progress, setProgress] = useState<number>(0);
  const [isMilestone, setIsMilestone] = useState(false);
  const [recurringInterval, setRecurringInterval] = useState<number>(7);
  const [recurringPrice, setRecurringPrice] = useState<number>(1500);
  const [recurringRangeType, setRecurringRangeType] = useState<"project" | "stages">("project");
  const [selectedRecurringStageIds, setSelectedRecurringStageIds] = useState<string[]>([]);

  useEffect(() => {
    setMoreOpen(false);
  }, [editTaskId]);

  useEffect(() => {
    if (editTaskId) {
      const task = tasks.find((t) => t.id === editTaskId);
      if (task) {
        setTitle(task.title);
        setDesc(task.desc);
        setManualStart(task.manualStart || "");
        setDuration(task.duration || 3);
        setUnit(task.durationHours ? "hours" : "days");
        setHours(task.durationHours || 4);
        setStartTime(task.startTime !== undefined ? formatTime(task.startTime) : "");
        setSelectedTradeIds(task.tradeIds || []);
        setLinks(taskLinks(task));
        setAssignments(task.assignments || []);
        setAllowWeekend(task.allowWeekend);
        setAllowHoliday(task.allowHoliday);
        setWeatherIndependent(task.weatherIndependent || false);
        setStageId(task.stageId || "");
        setIsRecurring(task.isRecurring || false);
        setProgress(task.progress || 0);
        setIsMilestone(task.isMilestone || false);
        setRecurringInterval(task.recurringInterval || 7);
        setRecurringPrice(task.recurringPrice || 1500);
        setRecurringRangeType(task.recurringRangeType || "project");
        setSelectedRecurringStageIds(task.recurringStageIds || []);
        const used = !!(task.desc || task.manualStart || task.stageId || task.isRecurring || task.isMilestone || task.progress || (task.assignments && task.assignments.length) || task.allowWeekend || task.allowHoliday || task.weatherIndependent);
        if (used) setMoreOpen(true);
      }
    } else {
      resetForm();
    }
  }, [editTaskId, tasks]);

  const resetForm = () => {
    setTitle("");
    setDesc("");
    setManualStart("");
    setDuration(3);
    setUnit("days");
    setHours(4);
    setStartTime("");
    setSelectedTradeIds([]);
    setLinks([]);
    setAssignments([]);
    setAllowWeekend(false);
    setAllowHoliday(false);
    setWeatherIndependent(false);
    setStageId("");
    setIsRecurring(false);
    setProgress(0);
    setIsMilestone(false);
    setRecurringInterval(7);
    setRecurringPrice(1500);
    setRecurringRangeType("project");
    setSelectedRecurringStageIds([]);
  };

  // Tasks that depend on this one cannot be chosen as predecessors (that would create a loop)
  const descendants = editTaskId ? descendantsOf(tasks, editTaskId) : new Set<string>();

  const updateLink = (idx: number, patch: Partial<Dependency>) =>
    setLinks(links.map((l, i) => (i === idx ? { ...l, ...patch } : l)));

  const toggleTradeSelection = (trId: string) => {
    if (selectedTradeIds.includes(trId)) {
      setSelectedTradeIds(selectedTradeIds.filter((id) => id !== trId));
    } else {
      setSelectedTradeIds([...selectedTradeIds, trId]);
    }
  };

  const toggleRecurringStageSelection = (sId: string) => {
    if (selectedRecurringStageIds.includes(sId)) {
      setSelectedRecurringStageIds(selectedRecurringStageIds.filter((id) => id !== sId));
    } else {
      setSelectedRecurringStageIds([...selectedRecurringStageIds, sId]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const cleanLinks = links.filter((l) => l.taskId);
    onSave({
      id: editTaskId || "task-" + Date.now(),
      title,
      desc,
      manualStart: isRecurring ? null : (manualStart || null),
      duration: isRecurring ? 0 : isMilestone ? 0 : unit === "hours" ? Math.max(1, Math.ceil(hours / hoursPerDay - 1e-9)) : Math.max(1, duration),
      durationHours: !isRecurring && !isMilestone && unit === "hours" ? Math.max(0.25, hours) : undefined,
      startTime: !isRecurring && !isMilestone && unit === "hours" && manualStart && parseTime(startTime) !== null ? (parseTime(startTime) as number) : undefined,
      tradeIds: selectedTradeIds,
      assignments: isRecurring || isMilestone ? undefined : cleanAssignments(assignments.filter((a) => selectedTradeIds.includes(a.tradeId)).map((a) => ({ ...a, label: a.label.trim() })), trades),
      dependencyId: isRecurring ? null : cleanLinks[0]?.taskId ?? null,
      dependencies: isRecurring ? [] : cleanLinks,
      allowWeekend,
      allowHoliday,
      weatherIndependent,
      stageId: isRecurring ? null : (stageId || null),
      isRecurring,
      progress: isRecurring ? 0 : progress,
      isMilestone: isRecurring ? false : isMilestone,
      recurringInterval: isRecurring ? Math.max(1, recurringInterval) : undefined,
      recurringPrice: isRecurring ? Math.max(0, recurringPrice) : undefined,
      recurringRangeType: isRecurring ? recurringRangeType : undefined,
      recurringStageIds: isRecurring ? selectedRecurringStageIds : undefined,
    });
    resetForm();
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-slate-100 rounded-xl p-5 shadow-xs flex flex-col gap-4">
      <h3 className={`text-base font-bold text-slate-800 border-b border-slate-100 pb-2 flex items-center gap-1.5 ${hideHeading ? "hidden" : ""}`}>
        <Plus className="w-5 h-5 text-slate-850" />
        <span>{editTaskId ? "Rediger Opgave" : "Opret Ny Opgave"}</span>
      </h3>
      {/* Row 1: Title & Desc */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-bold text-slate-500">Opgavetitel</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={isRecurring ? "F.eks. Ugentlig Affaldshåndtering eller Sikkerhedstjek..." : "F.eks. Træk føringsveje eller Aflevering..."}
          className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs font-semibold text-slate-700 outline-none focus:border-slate-500"
          autoFocus
          required
        />
      </div>

      {/* Recurring Task Options */}
      {isRecurring && (
        <div className="flex flex-col gap-4 border border-slate-200 bg-slate-50/70 p-4 rounded-xl">
          <span className="text-xs font-black text-slate-700">Parametre for gentagende service</span>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-slate-500 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-slate-500" />
                <span>Udførelsesinterval (Gentages hver x. dag)</span>
              </label>
              <input
                type="number"
                value={recurringInterval}
                onChange={(e) => setRecurringInterval(Math.max(1, parseInt(e.target.value) || 1))}
                className="bg-white border border-slate-200 rounded-lg p-2.5 text-xs font-bold text-slate-700 outline-none focus:border-slate-500"
                min={1}
                required
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-slate-500 flex items-center gap-1">
                <DollarSign className="w-3.5 h-3.5 text-slate-500" />
                <span>Fast Enhedspris pr. overførsel / gang (kr.)</span>
              </label>
              <input
                type="number"
                value={recurringPrice}
                onChange={(e) => setRecurringPrice(Math.max(0, parseInt(e.target.value) || 0))}
                className="bg-white border border-slate-200 rounded-lg p-2.5 text-xs font-bold text-slate-800 outline-none focus:border-slate-500"
                min={0}
                required
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold text-slate-500">Periode / Varighed for gentagelse</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-xs font-bold text-slate-600 cursor-pointer select-none">
                <input
                  type="radio"
                  name="recurringRangeType"
                  value="project"
                  checked={recurringRangeType === "project"}
                  onChange={() => setRecurringRangeType("project")}
                  className="w-4 h-4 accent-slate-700"
                />
                <span>Hele projektets varighed</span>
              </label>

              <label className="flex items-center gap-2 text-xs font-bold text-slate-600 cursor-pointer select-none">
                <input
                  type="radio"
                  name="recurringRangeType"
                  value="stages"
                  checked={recurringRangeType === "stages"}
                  onChange={() => setRecurringRangeType("stages")}
                  className="w-4 h-4 accent-slate-700"
                />
                <span>Kun under bestemte etaper / faser</span>
              </label>
            </div>
          </div>

          {recurringRangeType === "stages" && (
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-slate-500">Vælg etaper til gentagelsescyklus</label>
              {stages.length === 0 ? (
                <span className="text-xs text-red-500 font-semibold">Du skal oprette etaper i fanen Projekt først!</span>
              ) : (
                <div className="flex flex-wrap gap-1.5 p-2 bg-white rounded-lg border border-slate-200">
                  {stages.map((stg) => {
                    const checked = selectedRecurringStageIds.includes(stg.id);
                    return (
                      <button
                        key={stg.id}
                        type="button"
                        onClick={() => toggleRecurringStageSelection(stg.id)}
                        className={`px-2.5 py-1.5 rounded-lg border text-xs font-bold flex items-center gap-1.5 cursor-pointer transition ${
                          checked
                            ? "bg-slate-800 border-slate-800 text-white"
                            : "bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-600"
                        }`}
                      >
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: stg.color }} />
                        <span>{stg.name}</span>
                        {checked && <Check className="w-3 h-3 ml-1" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {!isRecurring && (
        <div className="grid grid-cols-1 gap-4">
            {isMilestone ? (
              <div className="flex flex-col justify-center bg-amber-50/50 border border-amber-200/40 rounded-lg p-3 text-xs text-amber-900 font-bold">
                ♦ Milepæl aktiveret: Opgaven varer 0 dage og fungerer som en markant deadline i tidsplanen.
              </div>
            ) : (
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-slate-500 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-slate-500" />
                  <span>Varighed</span>
                  <HelpTip label="Hjælp: varighed" text="Arbejdsdage tæller kun hverdage, uden helligdage. Vælg timer for små opgaver, der placeres efter klokken i arbejdsdagen." />
                </label>
                <div className="flex gap-1.5">
                  {unit === "days" ? (
                    <input
                      type="number"
                      aria-label="Varighed i arbejdsdage"
                      value={duration}
                      onChange={(e) => setDuration(Math.max(1, parseInt(e.target.value) || 1))}
                      className="flex-1 min-w-0 bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs font-bold text-slate-700 outline-none focus:border-slate-500"
                      min={1}
                      required
                    />
                  ) : (
                    <input
                      type="number"
                      data-testid="duration-hours"
                      aria-label="Varighed i timer"
                      value={hours}
                      onChange={(e) => setHours(Math.max(0, parseFloat(e.target.value) || 0))}
                      className="flex-1 min-w-0 bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs font-bold text-slate-700 outline-none focus:border-slate-500"
                      min={0.25}
                      step={0.25}
                      required
                    />
                  )}
                  <select
                    aria-label="Enhed"
                    data-testid="duration-unit"
                    value={unit}
                    onChange={(e) => setUnit(e.target.value as "days" | "hours")}
                    className="bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-bold text-slate-700 outline-none"
                  >
                    <option value="days">arbejdsdage</option>
                    <option value="hours">timer</option>
                  </select>
                </div>
                {unit === "hours" && (
                  <span className="text-xs text-slate-500 font-medium leading-snug">
                    Placeres efter arbejdstiden med klokkeslæt. Små opgaver kan følge efter hinanden samme dag.
                  </span>
                )}
              </div>
            )}
        </div>
      )}

      {/* Trades Checkboxes Selection container */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-bold text-slate-500">{isRecurring ? "Hvilken faggruppe står for servicen?" : "Faggruppe"}</label>
        {trades.length === 0 ? (
          <span className="text-xs text-slate-500 font-medium">Opret faggrupper under fanen Faggrupper først.</span>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 bg-slate-50 p-3 rounded-lg border border-slate-200 max-h-[140px] overflow-y-auto">
            {trades.map((tr) => {
              const checked = selectedTradeIds.includes(tr.id);
              return (
                <button
                  key={tr.id}
                  type="button"
                  onClick={() => toggleTradeSelection(tr.id)}
                  className={`p-2 rounded-lg border text-xs font-bold text-left flex items-center gap-1.5 transition cursor-pointer shrink-0 ${
                    checked
                      ? "bg-slate-900 border-slate-900 text-white"
                      : "bg-white hover:bg-slate-100 border-slate-200 text-slate-600"
                  }`}
                >
                  <span className="w-2 h-2 rounded-full ring-1 ring-slate-900/10 shrink-0" style={{ backgroundColor: tr.color }} />
                  <span className="truncate">{tr.name}</span>
                  {checked && <Check className="w-3.5 h-3.5 ml-auto text-emerald-400" />}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {!isRecurring && (
        <>
          {/* Predecessors: any number, Finish-to-Start or Start-to-Start, with lag/lead */}
          <div className="flex flex-col gap-2" data-testid="predecessors">
            <label className="text-xs font-bold text-slate-500 flex items-center gap-1">
              <Link className="w-3.5 h-3.5 text-slate-500" />
              <span>Afhænger af (forgængere)</span>
              <HelpTip label="Hjælp: forgængere" text="Hvilke opgaver skal være færdige (eller startet), før denne kan begynde. Systemet flytter opgaven automatisk, hvis forgængeren rykker." />
            </label>
            {links.length === 0 && (
              <p className="text-xs text-slate-500 font-medium">Ingen: opgaven starter med projektet eller på sin manuelle startdato.</p>
            )}
            {links.map((l, idx) => (
              <div key={idx} className="flex flex-wrap items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg p-2">
                <select
                  aria-label="Forgænger"
                  value={l.taskId}
                  onChange={(e) => updateLink(idx, { taskId: e.target.value })}
                  className="flex-1 min-w-[140px] bg-white border border-slate-200 rounded-lg p-2 text-xs font-bold text-slate-700 outline-none focus:border-slate-500"
                >
                  <option value="">Vælg opgave…</option>
                  {tasks.map((t) => {
                    if (t.isRecurring || t.id === editTaskId || descendants.has(t.id)) return null;
                    if (t.id !== l.taskId && links.some((o) => o.taskId === t.id)) return null;
                    return (
                      <option key={t.id} value={t.id}>
                        {t.title}
                      </option>
                    );
                  })}
                </select>
                <select
                  aria-label="Type af afhængighed"
                  value={l.type}
                  onChange={(e) => updateLink(idx, { type: e.target.value === "SS" ? "SS" : "FS" })}
                  className="bg-white border border-slate-200 rounded-lg p-2 text-xs font-bold text-slate-700 outline-none focus:border-slate-500"
                >
                  <option value="FS">Slut → Start</option>
                  <option value="SS">Start → Start</option>
                </select>
                <HelpTip label="Hjælp: Slut → Start og Start → Start" text="Slut → Start (FS): efterfølgeren starter, når forgængeren er færdig. Start → Start (SS): de to starter samtidig, evt. med forskydning, så arbejdet kan overlappe." />
                <label className="flex items-center gap-1 text-xs font-bold text-slate-500" title="Positivt tal = ventetid, negativt = forspring (kalenderdage)">
                  <span>Forskydning</span>
                  <HelpTip label="Hjælp: forskydning" text="Ventetid (positivt tal) eller forspring (negativt) i kalenderdage mellem de to opgaver, fx 3 dages hærdetid for beton." />
                  <input
                    type="number"
                    aria-label="Forskydning i dage"
                    value={l.lag}
                    onChange={(e) => updateLink(idx, { lag: Math.trunc(Number(e.target.value)) || 0 })}
                    className="w-16 bg-white border border-slate-200 rounded-lg p-2 text-xs font-bold text-slate-700 outline-none focus:border-slate-500"
                  />
                  <span>dage</span>
                </label>
                <button
                  type="button"
                  onClick={() => setLinks(links.filter((_, i) => i !== idx))}
                  aria-label="Fjern forgænger"
                  className="p-2 text-red-400 hover:text-red-700 hover:bg-red-50 rounded-lg cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => setLinks([...links, { taskId: "", type: "FS", lag: 0 }])}
              className="self-start text-xs font-extrabold text-sky-700 hover:underline cursor-pointer flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Tilføj forgænger</span>
            </button>
          </div>
        </>
      )}

      <div className="border border-slate-200 rounded-xl">
        <button
          type="button"
          data-testid="more-settings"
          aria-expanded={moreOpen}
          onClick={() => setMoreOpen(!moreOpen)}
          className="w-full flex items-center justify-between gap-2 px-3 py-3 min-h-[44px] text-sm font-bold text-slate-700 cursor-pointer hover:bg-slate-50 rounded-xl"
        >
          <span className="whitespace-nowrap">Flere indstillinger</span>
          <span className="hidden sm:inline text-xs font-medium text-slate-500 truncate">Beskrivelse, startdato, etape, underressourcer, weekend m.m.</span>
          <ChevronDown className={`w-4 h-4 shrink-0 transition-transform ${moreOpen ? "rotate-180" : ""}`} />
        </button>
        {moreOpen && (
          <div className="flex flex-col gap-4 p-3 border-t border-slate-200" data-testid="more-panel">
      <div className="flex flex-col gap-1">
        <label className="text-xs font-bold text-slate-500">Kort beskrivelse (valgfri)</label>
        <textarea
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          placeholder="Noter til montøren på farten..."
          rows={2}
          className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-700 outline-none focus:border-slate-500 resize-none"
        />
      </div>
      {/* Toggle is recurring task */}
      <div className="bg-slate-50 border border-slate-200/80 p-3 rounded-lg flex items-center justify-between">
        <div className="flex flex-col">
          <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
            <RefreshCw className="w-3.5 h-3.5 text-slate-550 animate-spin-slow" />
            <span>Er dette en tilbagevendende serviceopgave?</span>
          </span>
          <span className="text-xs text-slate-500 mt-0.5">
            Gentages automatisk med faste intervaller og afregnes pr. gang (Tømning, tilsyn m.m.).
          </span>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={isRecurring}
            onChange={(e) => setIsRecurring(e.target.checked)}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-slate-700"></div>
        </label>
      </div>
      {!isRecurring && (
        <>
          {/* Type of normal tasks: Milestone & Progress selectors */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50/50 border border-slate-200/60 p-3 rounded-xl">
            {/* Milestone Toggle */}
            <div className="flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-xs font-bold text-slate-800">Marker som Milepæl?</span>
                <span className="text-xs text-slate-500 mt-0.5">Et centralt kontrolpunkt (0 dg. varighed).</span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={isMilestone}
                  onChange={(e) => setIsMilestone(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-10 h-5.5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4.5 after:w-4.5 after:transition-all peer-checked:bg-slate-700"></div>
              </label>
            </div>

            {/* Task Progress Selector */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-slate-500 block">Færdiggørelsesgrad</label>
              <div className="flex bg-white border border-slate-200 rounded-lg p-0.5">
                {[0, 25, 50, 75, 100].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setProgress(val)}
                    className={`flex-1 text-center py-1 rounded-md text-xs font-extrabold transition cursor-pointer select-none ${
                      progress === val
                        ? "bg-slate-700 text-white shadow-xs"
                        : "text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {val}%
                  </button>
                ))}
              </div>
            </div>
          </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-slate-500 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-slate-500" />
                <span>Fast startdato (valgfri)</span>
              </label>
              <input
                type="date"
                value={manualStart}
                onChange={(e) => setManualStart(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-semibold text-slate-700 outline-none focus:border-slate-500"
              />
              {unit === "hours" && !isMilestone && manualStart && (
                <label className="flex items-center gap-1.5 text-xs font-bold text-slate-500 mt-1">
                  Tidligst kl.
                  <input
                    type="time"
                    aria-label="Starttidspunkt"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="bg-slate-50 border border-slate-200 rounded-lg p-1.5 text-xs font-semibold text-slate-700 outline-none focus:border-slate-500"
                  />
                </label>
              )}
            </div>
          {/* Stage Association Selector */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-slate-500 flex items-center gap-1">
              <Layers className="w-3.5 h-3.5 text-slate-500" />
              <span>Associeret Etape / Projektfase (valgfri)</span>
            </label>
            <select
              value={stageId}
              onChange={(e) => setStageId(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs font-bold text-slate-700 outline-none focus:border-slate-500"
            >
              <option value="">Ingen specifik etape (Frisvævende)</option>
              {stages.map((stg) => (
                <option key={stg.id} value={stg.id}>
                  {stg.name}
                </option>
              ))}
            </select>
          </div>
        </>
      )}

      {!isRecurring && !isMilestone && (
        <CrewEditor trades={trades.filter((t) => selectedTradeIds.includes(t.id))} assignments={assignments} onChange={setAssignments} />
      )}
      {/* Constraints Weekend/Holiday permissions boxes */}
      <div className="flex flex-col gap-3 sm:flex-row sm:gap-4 bg-slate-50/50 p-2.5 rounded-lg border border-slate-100">
        <label className="flex items-center gap-2 text-xs font-bold text-slate-600 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={allowWeekend}
            onChange={(e) => setAllowWeekend(e.target.checked)}
            className="w-4 h-4 accent-slate-700"
          />
          <span>Tillad weekendarbejde / kørsel</span>
        </label>

        <label className="flex items-center gap-2 text-xs font-bold text-slate-600 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={allowHoliday}
            onChange={(e) => setAllowHoliday(e.target.checked)}
            className="w-4 h-4 accent-slate-700"
          />
          <span>Arbejde på helligdage</span>
        </label>

        <label className="flex items-center gap-2 text-xs font-bold text-slate-600 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={weatherIndependent}
            onChange={(e) => setWeatherIndependent(e.target.checked)}
            className="w-4 h-4 accent-slate-700"
          />
          <span>Vejr-uafhængig opgave</span>
        </label>
      </div>
          </div>
        )}
      </div>

      {/* Form buttons */}
      <div className="flex gap-2 border-t border-slate-100 pt-3">
        <button
          type="submit"
          className="flex-1 bg-slate-700 hover:bg-slate-800 active:bg-slate-900 text-white text-xs font-extrabold py-3 rounded-lg flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
        >
          <Save className="w-4 h-4" />
          <span>{editTaskId ? "Opdater Opgave" : "Opret Opgave"}</span>
        </button>

        <button
          type="button"
          onClick={onCancel}
          className="px-4 bg-white hover:bg-slate-55 border border-slate-200 rounded-lg text-xs font-bold text-slate-500 cursor-pointer flex items-center justify-center gap-1"
        >
          <Ban className="w-4 h-4" />
          <span>Annuller</span>
        </button>
      </div>
    </form>
  );
}
