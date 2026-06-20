import React, { useState, useEffect } from "react";
import { Task, Trade, Stage } from "../types";
import { Save, Ban, Calendar, Clock, Link, Check, Plus, RefreshCw, Layers, DollarSign } from "lucide-react";

interface TaskFormProps {
  tasks: Task[];
  trades: Trade[];
  stages: Stage[];
  editTaskId: string | null;
  onSave: (task: Omit<Task, "calcStart" | "calcEnd" | "calcCost" | "isCritical" | "tradeCosts">) => void;
  onCancel: () => void;
}

export function TaskForm({ tasks, trades, stages, editTaskId, onSave, onCancel }: TaskFormProps) {
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [manualStart, setManualStart] = useState("");
  const [duration, setDuration] = useState<number>(3);
  const [selectedTradeIds, setSelectedTradeIds] = useState<string[]>([]);
  const [dependencyId, setDependencyId] = useState("");
  const [allowWeekend, setAllowWeekend] = useState(false);
  const [allowHoliday, setAllowHoliday] = useState(false);

  // Stage, Recurrence, Progress & Type additions
  const [stageId, setStageId] = useState("");
  const [isRecurring, setIsRecurring] = useState(false);
  const [progress, setProgress] = useState<number>(0);
  const [isMilestone, setIsMilestone] = useState(false);
  const [recurringInterval, setRecurringInterval] = useState<number>(7);
  const [recurringPrice, setRecurringPrice] = useState<number>(1500);
  const [recurringRangeType, setRecurringRangeType] = useState<"project" | "stages">("project");
  const [selectedRecurringStageIds, setSelectedRecurringStageIds] = useState<string[]>([]);

  useEffect(() => {
    if (editTaskId) {
      const task = tasks.find((t) => t.id === editTaskId);
      if (task) {
        setTitle(task.title);
        setDesc(task.desc);
        setManualStart(task.manualStart || "");
        setDuration(task.duration || 3);
        setSelectedTradeIds(task.tradeIds || []);
        setDependencyId(task.dependencyId || "");
        setAllowWeekend(task.allowWeekend);
        setAllowHoliday(task.allowHoliday);
        setStageId(task.stageId || "");
        setIsRecurring(task.isRecurring || false);
        setProgress(task.progress || 0);
        setIsMilestone(task.isMilestone || false);
        setRecurringInterval(task.recurringInterval || 7);
        setRecurringPrice(task.recurringPrice || 1500);
        setRecurringRangeType(task.recurringRangeType || "project");
        setSelectedRecurringStageIds(task.recurringStageIds || []);
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
    setSelectedTradeIds([]);
    setDependencyId("");
    setAllowWeekend(false);
    setAllowHoliday(false);
    setStageId("");
    setIsRecurring(false);
    setProgress(0);
    setIsMilestone(false);
    setRecurringInterval(7);
    setRecurringPrice(1500);
    setRecurringRangeType("project");
    setSelectedRecurringStageIds([]);
  };

  // Help trace child descendants to prevent loops in predecessor selector
  const getDescendants = (tId: string): Set<string> => {
    const result = new Set<string>();
    let changed = true;
    while (changed) {
      changed = false;
      tasks.forEach((t) => {
        if (t.dependencyId && (t.dependencyId === tId || result.has(t.dependencyId)) && !result.has(t.id)) {
          result.add(t.id);
          changed = true;
        }
      });
    }
    return result;
  };

  const descendants = editTaskId ? getDescendants(editTaskId) : new Set<string>();

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

    onSave({
      id: editTaskId || "task-" + Date.now(),
      title,
      desc,
      manualStart: isRecurring ? null : (manualStart || null),
      duration: isRecurring ? 0 : (isMilestone ? 0 : Math.max(1, duration)),
      tradeIds: selectedTradeIds,
      dependencyId: isRecurring ? null : (dependencyId || null),
      allowWeekend,
      allowHoliday,
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
    <form onSubmit={handleSubmit} className="bg-white border border-slate-100 rounded-xl p-5 shadow-xs flex flex-col gap-4 select-none">
      <h3 className="text-base font-bold text-slate-800 border-b border-slate-100 pb-2 flex items-center gap-1.5">
        <Plus className="w-5 h-5 text-slate-850" />
        <span>{editTaskId ? "Rediger Opgave" : "Opret Ny Opgave"}</span>
      </h3>

      {/* Toggle is recurring task */}
      <div className="bg-slate-50 border border-slate-200/80 p-3 rounded-lg flex items-center justify-between">
        <div className="flex flex-col">
          <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
            <RefreshCw className="w-3.5 h-3.5 text-slate-550 animate-spin-slow" />
            <span>Er dette en tilbagevendende serviceopgave?</span>
          </span>
          <span className="text-[10px] text-slate-500 mt-0.5">
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

      {/* Row 1: Title & Desc */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Opgavetitel</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={isRecurring ? "F.eks. Ugentlig Affaldshåndtering eller Sikkerhedstjek..." : "F.eks. Træk føringsveje eller Aflevering..."}
          className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs font-semibold text-slate-700 outline-none focus:border-slate-500"
          required
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Kort beskrivelse (valgfri)</label>
        <textarea
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          placeholder="Noter til montøren på farten..."
          rows={2}
          className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-700 outline-none focus:border-slate-500 resize-none"
        />
      </div>

      {/* Normal Task Section */}
      {!isRecurring && (
        <>
          {/* Type of normal tasks: Milestone & Progress selectors */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50/50 border border-slate-200/60 p-3 rounded-xl">
            {/* Milestone Toggle */}
            <div className="flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-xs font-bold text-slate-800">Marker som Milepæl?</span>
                <span className="text-[10px] text-slate-500 mt-0.5">Et centralt kontrolpunkt (0 dg. varighed).</span>
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
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Færdiggørelsesgrad</label>
              <div className="flex bg-white border border-slate-200 rounded-lg p-0.5">
                {[0, 25, 50, 75, 100].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setProgress(val)}
                    className={`flex-1 text-center py-1 rounded-md text-[10px] font-extrabold transition cursor-pointer select-none ${
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

          {/* Row 2: Duration & Manual Start */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {isMilestone ? (
              <div className="flex flex-col justify-center bg-amber-50/50 border border-amber-200/40 rounded-lg p-3 text-[10px] text-amber-900 font-bold">
                ♦ Milepæl aktiveret: Opgaven varer 0 dage og fungerer som en markant deadline i tidsplanen.
              </div>
            ) : (
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  <span>Varighed (arbejdsdage)</span>
                </label>
                <input
                  type="number"
                  value={duration}
                  onChange={(e) => setDuration(Math.max(1, parseInt(e.target.value) || 1))}
                  className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs font-bold text-slate-700 outline-none focus:border-slate-500"
                  min={1}
                  required
                />
              </div>
            )}

            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span>Fast startdato (valgfri)</span>
              </label>
              <input
                type="date"
                value={manualStart}
                onChange={(e) => setManualStart(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-semibold text-slate-700 outline-none focus:border-slate-500"
              />
            </div>
          </div>

          {/* Stage Association Selector */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
              <Layers className="w-3.5 h-3.5 text-slate-400" />
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

          {/* Predecessor Dependency Selection */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
              <Link className="w-3.5 h-3.5 text-slate-400" />
              <span>Afhænger af (Finish-to-Start forgænger)</span>
            </label>
            <select
              value={dependencyId}
              onChange={(e) => setDependencyId(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs font-bold text-slate-700 outline-none focus:border-slate-500"
            >
              <option value="">Starter med projektet eller manuel startdato</option>
              {tasks.map((t) => {
                if (t.isRecurring) return null; // No dependencies on recurring tasks
                const isInvalidSelf = t.id === editTaskId;
                const isDescendant = descendants.has(t.id);
                if (isInvalidSelf || isDescendant) return null;

                return (
                  <option key={t.id} value={t.id}>
                    {t.title}
                  </option>
                );
              })}
            </select>
          </div>
        </>
      )}

      {/* Recurring Task Options */}
      {isRecurring && (
        <div className="flex flex-col gap-4 border border-slate-200 bg-slate-50/70 p-4 rounded-xl">
          <span className="text-[10px] font-black uppercase text-slate-700 tracking-wider">Parametre for gentagende service</span>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
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
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <DollarSign className="w-3.5 h-3.5 text-slate-400" />
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
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Periode / Varighed for gentagelse</label>
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
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Vælg etaper til gentagelsescyklus</label>
              {stages.length === 0 ? (
                <span className="text-[10px] text-red-500 font-semibold">Du skal oprette etaper i fanen Projekt først!</span>
              ) : (
                <div className="flex flex-wrap gap-1.5 p-2 bg-white rounded-lg border border-slate-200">
                  {stages.map((stg) => {
                    const checked = selectedRecurringStageIds.includes(stg.id);
                    return (
                      <button
                        key={stg.id}
                        type="button"
                        onClick={() => toggleRecurringStageSelection(stg.id)}
                        className={`px-2.5 py-1.5 rounded-lg border text-[10px] font-bold flex items-center gap-1.5 cursor-pointer transition ${
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

      {/* Trades Checkboxes Selection container */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Hvilken resurse står for servicen?</label>
        {trades.length === 0 ? (
          <span className="text-[10px] text-slate-400 font-medium">Opret faggrupper under fanen 👷 Resurser først.</span>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 bg-slate-50 p-3 rounded-lg border border-slate-200 max-h-[140px] overflow-y-auto">
            {trades.map((tr) => {
              const checked = selectedTradeIds.includes(tr.id);
              return (
                <button
                  key={tr.id}
                  type="button"
                  onClick={() => toggleTradeSelection(tr.id)}
                  className={`p-2 rounded-lg border text-[10px] font-bold text-left flex items-center gap-1.5 transition cursor-pointer shrink-0 ${
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

      {/* Constraints Weekend/Holiday permissions boxes */}
      <div className="flex flex-col sm:flex-row gap-4 bg-slate-50/50 p-2.5 rounded-lg border border-slate-100">
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

        {editTaskId && (
          <button
            type="button"
            onClick={onCancel}
            className="px-4 bg-white hover:bg-slate-55 border border-slate-200 rounded-lg text-xs font-bold text-slate-500 cursor-pointer flex items-center justify-center gap-1"
          >
            <Ban className="w-4 h-4" />
            <span>Annuller</span>
          </button>
        )}
      </div>
    </form>
  );
}
