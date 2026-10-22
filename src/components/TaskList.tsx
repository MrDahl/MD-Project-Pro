import { useEffect, useMemo, useState } from "react";
import { ListChecks, PlusCircle, Search, Layers } from "lucide-react";
import type { Stage, Task, Trade } from "../types";
import { EMPTY_FILTER, filterTasks, isFilterActive, type TaskFilter } from "../utils/taskFilter";
import { TaskCard } from "./TaskCard";

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
}

const selectCls =
  "p-1.5 px-2.5 rounded-lg border border-slate-200 text-xs font-bold bg-white text-slate-700 cursor-pointer focus:outline-sky-500";

export function TaskList({ tasks, trades, stages, stageById, tradeById, onNew, onEdit, onDelete, onDuplicate }: Props) {
  const [filter, setFilter] = useState<TaskFilter>(EMPTY_FILTER);
  const [groupByStage, setGroupByStage] = useState(false);
  const [limit, setLimit] = useState(PAGE);

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
          <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
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
        <h3 className="text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-wider" data-testid="task-count">
          {active ? `Viser ${items.length} af ${tasks.length} opgaver` : `Opgaver (${tasks.length})`}
        </h3>
        <button
          type="button"
          onClick={onNew}
          className="bg-slate-900 hover:bg-black text-white font-black text-xs py-2 px-3 rounded-lg cursor-pointer flex items-center gap-1 shadow-xs min-h-[34px]"
        >
          <PlusCircle className="w-3.5 h-3.5" />
          <span>Ny opgave</span>
        </button>
      </div>

      {tasks.length === 0 ? (
        <div className="bg-white border border-dashed border-slate-200 p-8 md:p-12 text-center rounded-xl text-xs text-slate-400 flex flex-col items-center justify-center">
          <ListChecks className="w-10 h-10 text-slate-200 mb-2" />
          <p className="font-semibold text-slate-500">Intet planlagt endnu</p>
          <p className="text-[10px] text-slate-400 mt-1 max-w-xs leading-relaxed">Tryk på "Ny opgave" og angiv faggrupper og varighed for at se dem her.</p>
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
                  <span className="text-slate-400 font-bold">({g.rows.length})</span>
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
