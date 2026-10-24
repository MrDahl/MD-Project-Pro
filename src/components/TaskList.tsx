import { useCallback, useEffect, useMemo, useState } from "react";
import { ListChecks, PlusCircle, Search, Layers, CheckSquare, Printer } from "lucide-react";
import type { Stage, Task, Trade } from "../types";
import { usePersistedState } from "../utils/persist";
import { EMPTY_FILTER, filterTasks, isFilterActive, type TaskFilter } from "../utils/taskFilter";
import { TaskCard } from "./TaskCard";
import type { BulkChange } from "../utils/bulk";

const PAGE = 100;

interface Props {
  tasks: Task[]; // calculated tasks
  trades: Trade[];
  stages: Stage[];
  stageById: Map<string, Stage>;
  tradeById: Map<string, Trade>;
  onNew: () => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  onBulkApply: (ids: string[], change: BulkChange) => void;
  onBulkDelete: (ids: string[]) => void;
}

const selectCls =
  "p-1.5 px-2.5 rounded-lg border border-slate-200 text-xs font-bold bg-white text-slate-700 cursor-pointer focus:outline-sky-500";

export function TaskList({ tasks, trades, stages, stageById, tradeById, onNew, onEdit, onDelete, onDuplicate, onBulkApply, onBulkDelete }: Props) {
  const [filter, setFilter] = usePersistedState<TaskFilter>("mdppListFilter", EMPTY_FILTER, (r) => {
    const o = r as Partial<TaskFilter> | null;
    if (!o || typeof o !== "object") return undefined;
    return {
      query: "",
      stageId: typeof o.stageId === "string" ? o.stageId : "",
      tradeId: typeof o.tradeId === "string" ? o.tradeId : "",
      criticalOnly: o.criticalOnly === true,
    };
  });
  const [groupByStage, setGroupByStage] = usePersistedState<boolean>("mdppListGroup", false, (r) => (typeof r === "boolean" ? r : undefined));
  // A remembered filter must not point at a stage or trade that no longer exists
  useEffect(() => {
    const badStage = filter.stageId && filter.stageId !== "none" && !stages.some((s) => s.id === filter.stageId);
    const badTrade = filter.tradeId && !trades.some((t) => t.id === filter.tradeId);
    if (badStage || badTrade) setFilter({ ...filter, stageId: badStage ? "" : filter.stageId, tradeId: badTrade ? "" : filter.tradeId });
  }, [filter, stages, trades, setFilter]);
  const [limit, setLimit] = useState(PAGE);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const toggleSelect = useCallback(
    (id: string) =>
      setSelected((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      }),
    []
  );
  // Tasks that disappeared (deleted, undo) can no longer be selected
  useEffect(() => {
    setSelected((prev) => {
      const ids = new Set(tasks.map((t) => t.id));
      const keep = [...prev].filter((id) => ids.has(id));
      return keep.length === prev.size ? prev : new Set(keep);
    });
  }, [tasks]);
  const exitSelect = () => {
    setSelectMode(false);
    setSelected(new Set());
  };

  const items = useMemo(() => filterTasks(tasks, trades, filter), [tasks, trades, filter]);
  const active = isFilterActive(filter);

  // Showing at most `limit` cards keeps very large lists light; "Vis flere" reveals the rest
  useEffect(() => setLimit(PAGE), [filter, groupByStage]);
  const shown = items.length > limit ? items.slice(0, limit) : items;

  const groups = useMemo(() => {
    if (!groupByStage) return [{ key: "all", stage: null as Stage | null, rows: shown }];
    const byStage = new Map<string, typeof shown>();
    for (const row of shown) {
      const k = row.task.stageId && stageById.has(row.task.stageId) ? row.task.stageId : "none";
      const list = byStage.get(k);
      if (list) list.push(row);
      else byStage.set(k, [row]);
    }
    const ordered = [...stages.filter((s) => byStage.has(s.id)).map((s) => ({ key: s.id, stage: s as Stage | null, rows: byStage.get(s.id)! }))];
    if (byStage.has("none")) ordered.push({ key: "none", stage: null, rows: byStage.get("none")! });
    return ordered;
  }, [groupByStage, shown, stages, stageById]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2 bg-white border border-slate-200 rounded-xl p-3 shadow-2xs">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="w-4 h-4 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="search"
            value={filter.query}
            onChange={(e) => setFilter({ ...filter, query: e.target.value })}
            placeholder="Søg i opgaver, noter og faggrupper…"
            aria-label="Søg i opgaver"
            className="w-full pl-8 pr-2 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold bg-slate-50 outline-none focus:border-slate-400"
          />
        </div>
        <select aria-label="Filtrer på etape" value={filter.stageId} onChange={(e) => setFilter({ ...filter, stageId: e.target.value })} className={selectCls}>
          <option value="">Alle etaper</option>
          {stages.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
          <option value="none">Uden etape</option>
        </select>
        <select aria-label="Filtrer på faggruppe" value={filter.tradeId} onChange={(e) => setFilter({ ...filter, tradeId: e.target.value })} className={selectCls}>
          <option value="">Alle faggrupper</option>
          {trades.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
        <label className="flex items-center gap-1.5 text-xs font-bold text-slate-600 cursor-pointer">
          <input type="checkbox" checked={filter.criticalOnly} onChange={(e) => setFilter({ ...filter, criticalOnly: e.target.checked })} className="accent-red-600" />
          Kun kritiske
        </label>
        <label className="flex items-center gap-1.5 text-xs font-bold text-slate-600 cursor-pointer">
          <input type="checkbox" checked={groupByStage} onChange={(e) => setGroupByStage(e.target.checked)} className="accent-slate-700" />
          Gruppér efter etape
        </label>
        {active && (
          <button type="button" onClick={() => setFilter(EMPTY_FILTER)} className="text-xs font-extrabold text-sky-700 hover:underline cursor-pointer">
            Ryd filter
          </button>
        )}
      </div>

      <div className="flex items-center justify-between gap-2 px-1">
        <h3 className="text-xs md:text-xs font-bold text-slate-500" data-testid="task-count">
          {active ? `Viser ${items.length} af ${tasks.length} opgaver` : `Opgaver (${tasks.length})`}
        </h3>
        <div className="flex items-center gap-2">
        <button
          type="button"
          data-testid="print-list"
          onClick={() => window.print()}
          className="border font-extrabold text-xs py-2 px-3 rounded-lg cursor-pointer flex items-center gap-1 min-h-[34px] bg-white hover:bg-slate-100 border-slate-200 text-slate-700 print:hidden"
        >
          <Printer className="w-3.5 h-3.5" />
          <span>Print liste</span>
        </button>
        <button
          type="button"
          data-testid="toggle-select"
          aria-pressed={selectMode}
          onClick={() => (selectMode ? exitSelect() : setSelectMode(true))}
          className={`border font-extrabold text-xs py-2 px-3 rounded-lg cursor-pointer flex items-center gap-1 min-h-[34px] ${
            selectMode ? "bg-sky-600 border-sky-600 text-white" : "bg-white hover:bg-slate-100 border-slate-200 text-slate-700"
          }`}
        >
          <CheckSquare className="w-3.5 h-3.5" />
          <span>Vælg flere</span>
        </button>
        <button
          type="button"
          onClick={onNew}
          className="bg-slate-900 hover:bg-black text-white font-black text-xs py-2 px-3 rounded-lg cursor-pointer flex items-center gap-1 shadow-xs min-h-[34px]"
        >
          <PlusCircle className="w-3.5 h-3.5" />
          <span>Ny opgave</span>
        </button>
        </div>
      </div>

      {selectMode && (
        <BulkBar
          count={selected.size}
          total={items.length}
          trades={trades}
          stages={stages}
          onSelectAll={() => setSelected(new Set(items.map((i) => i.task.id)))}
          onClear={() => setSelected(new Set())}
          onApply={(change) => onBulkApply([...selected], change)}
          onDelete={() => {
            onBulkDelete([...selected]);
            setSelected(new Set());
          }}
          onDone={exitSelect}
        />
      )}



      {tasks.length === 0 ? (
        <div className="bg-white border border-dashed border-slate-200 p-8 md:p-12 text-center rounded-xl text-xs text-slate-500 flex flex-col items-center justify-center">
          <ListChecks className="w-10 h-10 text-slate-200 mb-2" />
          <p className="font-semibold text-slate-500">Intet planlagt endnu</p>
          <p className="text-xs text-slate-500 mt-1 max-w-xs leading-relaxed">Tryk på "Ny opgave" og angiv faggrupper og varighed for at se dem her.</p>
        </div>
      ) : items.length === 0 ? (
        <div className="bg-white border border-dashed border-slate-200 p-8 text-center rounded-xl text-xs text-slate-500 font-semibold">
          Ingen opgaver matcher dit filter.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {groups.map((g) => (
            <section key={g.key} className="flex flex-col gap-3">
              {groupByStage && (
                <h4 className="flex items-center gap-1.5 text-xs font-black text-slate-700 mt-2 px-1">
                  <Layers className="w-3.5 h-3.5" style={{ color: g.stage?.color ?? "#94a3b8" }} />
                  {g.stage ? g.stage.name : "Uden etape"}
                  <span className="text-slate-500 font-bold">({g.rows.length})</span>
                </h4>
              )}
              {g.rows.map(({ task, number }) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  number={number}
                  stageById={stageById}
                  tradeById={tradeById}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onDuplicate={onDuplicate}
                  selectMode={selectMode}
                  selected={selected.has(task.id)}
                  onToggleSelect={toggleSelect}
                />
              ))}
            </section>
          ))}
          {items.length > shown.length && (
            <button
              type="button"
              onClick={() => setLimit(limit + PAGE)}
              className="self-center px-4 py-2 rounded-lg bg-white border border-slate-200 text-xs font-extrabold text-slate-700 hover:bg-slate-100 cursor-pointer"
            >
              Vis flere ({items.length - shown.length} skjult)
            </button>
          )}
        </div>
      )}
    </div>
  );
}

interface BulkBarProps {
  count: number;
  total: number;
  trades: Trade[];
  stages: Stage[];
  onSelectAll: () => void;
  onClear: () => void;
  onApply: (change: BulkChange) => void;
  onDelete: () => void;
  onDone: () => void;
}

/** Actions for the selected tasks. Each dropdown applies as soon as a value is picked, then resets. */
function BulkBar({ count, total, trades, stages, onSelectAll, onClear, onApply, onDelete, onDone }: BulkBarProps) {
  const [days, setDays] = useState("");
  const off = count === 0;
  const pick = (fn: (v: string) => BulkChange | null) => (e: React.ChangeEvent<HTMLSelectElement>) => {
    const v = e.target.value;
    e.target.value = "";
    if (!v) return;
    const change = fn(v);
    if (change) onApply(change);
  };
  return (
    <div data-testid="bulk-bar" className="sticky top-2 z-30 bg-sky-50 border border-sky-200 rounded-xl p-3 shadow-sm flex flex-wrap items-center gap-2">
      <span className="text-xs font-black text-sky-900" data-testid="bulk-count">
        {count} valgt
      </span>
      <button type="button" onClick={onSelectAll} className="text-xs font-extrabold text-sky-700 hover:underline cursor-pointer">
        Vælg alle {total}
      </button>
      <button type="button" onClick={onClear} disabled={off} className="text-xs font-extrabold text-sky-700 hover:underline cursor-pointer disabled:opacity-40">
        Fravælg
      </button>
      <span className="w-px h-5 bg-sky-200 mx-1" />
      <select aria-label="Sæt etape" disabled={off} defaultValue="" onChange={pick((v) => ({ stageId: v === "none" ? null : v }))} className={selectCls}>
        <option value="">Sæt etape…</option>
        {stages.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
        <option value="none">Ingen etape</option>
      </select>
      <select aria-label="Tilføj faggruppe" disabled={off} defaultValue="" onChange={pick((v) => ({ addTradeId: v }))} className={selectCls}>
        <option value="">Tilføj faggruppe…</option>
        {trades.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
      <select aria-label="Skift faggruppe til" disabled={off} defaultValue="" onChange={pick((v) => ({ setTradeId: v }))} className={selectCls}>
        <option value="">Skift faggruppe til…</option>
        {trades.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
      <div className="flex items-center gap-1">
        <input
          type="number"
          min={1}
          aria-label="Varighed i dage"
          placeholder="dage"
          value={days}
          onChange={(e) => setDays(e.target.value)}
          className="w-16 p-1.5 rounded-lg border border-slate-200 text-xs font-bold bg-white"
        />
        <button
          type="button"
          disabled={off || !(Number(days) >= 1)}
          onClick={() => {
            onApply({ duration: Number(days) });
            setDays("");
          }}
          className="px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-extrabold text-slate-700 hover:bg-slate-100 cursor-pointer disabled:opacity-40"
        >
          Sæt varighed
        </button>
      </div>
      <button
        type="button"
        data-testid="bulk-delete"
        disabled={off}
        onClick={() => {
          if (window.confirm(`Slet ${count} opgaver? Det kan fortrydes med Fortryd.`)) onDelete();
        }}
        className="px-2.5 py-1.5 rounded-lg bg-red-50 border border-red-200 text-xs font-extrabold text-red-700 hover:bg-red-100 cursor-pointer disabled:opacity-40"
      >
        Slet valgte
      </button>
      <button type="button" onClick={onDone} className="ml-auto px-3 py-1.5 rounded-lg bg-sky-600 text-white text-xs font-extrabold hover:bg-sky-700 cursor-pointer">
        Færdig
      </button>
    </div>
  );
}
