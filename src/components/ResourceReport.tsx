import { CostRows, groupCostRows } from "./CostRows";
import { useState } from "react";
import { Users } from "lucide-react";
import type { Stage, Task, Trade } from "../types";
import { resourceReport } from "../utils/roles";

interface Props {
  tasks: Task[];
  trades: Trade[];
  stages: Stage[];
  workHoursPerDay: number;
}

const kr = (n: number) => `${Math.round(n).toLocaleString("da-DK")} kr.`;
const sel = "bg-white border border-slate-200 rounded-lg p-2 text-xs font-bold text-slate-700 outline-none focus:border-slate-500";

/** Cost per faggruppe with a split on roles (sub-resources) and activities. */
export function ResourceReport({ tasks, trades, stages, workHoursPerDay }: Props) {
  const [tradeId, setTradeId] = useState("");
  const [stageId, setStageId] = useState("");
  if (trades.length === 0) return null;
  const trade = trades.find((t) => t.id === tradeId) ?? trades[0];
  const rep = resourceReport(tasks, trade, stageId);
  const days = (h: number) => (workHoursPerDay > 0 ? h / workHoursPerDay : 0);

  return (
    <div className="flex flex-col gap-3" data-testid="resource-report">
      <h4 className="text-xs font-bold text-slate-600 border-b border-slate-100 pb-1 flex items-center gap-1">
        <Users className="w-3.5 h-3.5" />
        <span>Overblik pr. faggruppe</span>
      </h4>
      <div className="flex flex-wrap gap-2 print:hidden">
        <select aria-label="Faggruppe" value={trade.id} onChange={(e) => setTradeId(e.target.value)} className={sel}>
          {trades.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <select aria-label="Etape" value={stageId} onChange={(e) => setStageId(e.target.value)} className={sel}>
          <option value="">Alle etaper</option>
          {stages.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

      <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-3">
        <span className="text-xs font-black text-slate-700 flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: trade.color }} />
          {trade.name}
        </span>
        <span data-testid="resource-total" className="font-black tabular-nums text-slate-900">
          {kr(rep.total)}
        </span>
      </div>

      {rep.byRole.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <div className="grid grid-cols-[1fr_70px_80px_100px] gap-2 text-xs font-black text-slate-600 px-2.5">
            <span>Rolle</span>
            <span className="text-right">Timer</span>
            <span className="text-right">Mandedage</span>
            <span className="text-right">Pris</span>
          </div>
          {rep.byRole.map((r) => (
            <div key={r.roleId} data-testid="role-cost" className="grid grid-cols-[1fr_70px_80px_100px] gap-2 text-xs p-2.5 bg-white border border-slate-200 rounded-xl">
              <span className="font-bold text-slate-700 truncate">
                {r.name} <span className="text-slate-600 font-semibold">(har {r.count})</span>
              </span>
              <span className="text-right tabular-nums text-slate-600">{Math.round(r.hours).toLocaleString("da-DK")}</span>
              <span className="text-right tabular-nums text-slate-600">{days(r.hours).toLocaleString("da-DK", { maximumFractionDigits: 1 })}</span>
              <span className="text-right tabular-nums font-extrabold text-slate-800">{kr(r.cost)}</span>
            </div>
          ))}
        </div>
      )}

      {rep.byActivity.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-black text-slate-600 px-0.5">Aktiviteter</span>
          {rep.byActivity.map((a) => (
            <div key={a.label} className="flex justify-between text-xs p-2.5 bg-white border border-slate-200 rounded-xl">
              <span className="font-semibold text-slate-700 truncate">
                {a.label} <span className="text-slate-600">({a.tasks} opgaver)</span>
              </span>
              <span className="tabular-nums font-extrabold text-slate-800">{kr(a.cost)}</span>
            </div>
          ))}
        </div>
      )}

      {rep.unstaffed > 0.5 && rep.byRole.length > 0 && (
        <div className="text-xs text-slate-600 font-semibold">Ubemandede opgaver (standardtakst): {kr(rep.unstaffed)}</div>
      )}

      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-black text-slate-600 px-0.5">Opgaver ({rep.byTask.length}), dyreste først</span>
        {rep.byTask.length === 0 ? (
          <span className="text-xs text-slate-600 font-medium">Ingen opgaver for denne faggruppe i valgt omfang.</span>
        ) : (
          <CostRows rows={groupCostRows(rep.byTask.map((t) => ({ id: t.id, title: t.title, cost: t.cost })))} />
        )}
      </div>
    </div>
  );
}
