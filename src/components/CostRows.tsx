import { useState } from "react";

export interface CostRow {
  key: string;
  title: string;
  cost: number;
  /** Number of tasks with this title that are merged into the row */
  count: number;
}

/** Merge rows with the same title (e.g. one task repeated per apartment) and sort by cost. */
export function groupCostRows(items: { id: string; title: string; cost: number }[]): CostRow[] {
  const map = new Map<string, CostRow>();
  for (const it of items) {
    const row = map.get(it.title);
    if (row) {
      row.cost += it.cost;
      row.count += 1;
    } else map.set(it.title, { key: it.id, title: it.title, cost: it.cost, count: 1 });
  }
  return [...map.values()].sort((a, b) => b.cost - a.cost);
}

const kr = (n: number) => Math.round(n).toLocaleString("da-DK");

/** The most expensive rows first, with a button to show the rest (no scroll box inside the page). */
export function CostRows({ rows, limit = 10 }: { rows: CostRow[]; limit?: number }) {
  const [all, setAll] = useState(false);
  const shown = all ? rows : rows.slice(0, limit);
  return (
    <div className="flex flex-col gap-1.5" data-testid="cost-rows">
      {shown.map((r) => (
        <div key={r.key} className="flex justify-between items-center gap-3 text-xs p-2.5 bg-slate-50 rounded-xl border border-slate-200">
          <span className="font-semibold text-slate-700 min-w-0 break-words">
            {r.title}
            {r.count > 1 && <span className="text-slate-600 font-bold"> ×{r.count}</span>}
          </span>
          <span className="font-extrabold text-slate-800 tabular-nums shrink-0">{kr(r.cost)} kr.</span>
        </div>
      ))}
      {rows.length > limit && (
        <button
          type="button"
          data-testid="cost-rows-toggle"
          onClick={() => setAll(!all)}
          className="self-start text-sm font-bold text-sky-700 hover:underline cursor-pointer py-2"
        >
          {all ? "Vis færre" : `Vis alle (${rows.length})`}
        </button>
      )}
    </div>
  );
}
