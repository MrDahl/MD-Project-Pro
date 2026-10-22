import { useMemo } from "react";
import type { Baseline, Task } from "../types";
import { buildCostCurve, costItemsFromBaseline, costItemsFromTasks, sampleIndices } from "../utils/curve";
import { dayNumber, dayToStr } from "../utils/scheduler";

const W = 640;
const H = 260;
const M = { l: 64, r: 16, t: 14, b: 30 };
const MONTHS = ["jan", "feb", "mar", "apr", "maj", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];

const kr = (n: number) => Math.round(n).toLocaleString("da-DK");

/** Rounds `max` up to a "nice" axis maximum and returns the tick step. */
function niceScale(max: number): { top: number; step: number } {
  if (max <= 0) return { top: 1, step: 1 };
  const raw = max / 4;
  const pow = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= raw) ?? 10 * pow;
  return { top: Math.ceil(max / step) * step, step };
}

/** Accumulated cost over time (the "S-curve"), optionally against the saved baseline. */
export function CostCurve({ tasks, baseline }: { tasks: Task[]; baseline?: Baseline | null }) {
  const chart = useMemo(() => {
    const cur = costItemsFromTasks(tasks);
    const base = baseline ? costItemsFromBaseline(baseline) : [];
    const all = [...cur, ...base];
    if (all.length === 0) return null;
    const lo = Math.min(...all.map((i) => i.start));
    const hi = Math.max(...all.map((i) => i.end));
    const curve = buildCostCurve(cur, lo, hi);
    const baseCurve = base.length > 0 ? buildCostCurve(base, lo, hi) : null;
    const maxV = Math.max(curve.values[curve.values.length - 1] ?? 0, baseCurve?.values[baseCurve.values.length - 1] ?? 0);
    return { lo, hi, curve, baseCurve, scale: niceScale(maxV) };
  }, [tasks, baseline]);

  if (!chart) {
    return <p className="text-xs text-slate-500 font-medium">Kurven vises, når der er opgaver med omkostninger.</p>;
  }

  const { lo, hi, curve, baseCurve, scale } = chart;
  const n = hi - lo + 1;
  const x = (day: number) => M.l + ((day - lo) / Math.max(1, n - 1)) * (W - M.l - M.r);
  const y = (v: number) => H - M.b - (v / scale.top) * (H - M.t - M.b);
  const points = (values: number[]) =>
    sampleIndices(values.length, 160)
      .map((i) => `${x(lo + i).toFixed(1)},${y(values[i]).toFixed(1)}`)
      .join(" ");

  const yTicks: number[] = [];
  for (let v = 0; v <= scale.top + 1e-9; v += scale.step) yTicks.push(v);

  // About 6 month labels along the bottom
  const xTicks: { day: number; label: string }[] = [];
  const first = new Date(lo * 86_400_000);
  let yy = first.getUTCFullYear();
  let mm = first.getUTCMonth();
  const monthCount = (new Date(hi * 86_400_000).getUTCFullYear() - yy) * 12 + new Date(hi * 86_400_000).getUTCMonth() - mm + 1;
  const every = Math.max(1, Math.ceil(monthCount / 6));
  for (let k = 0; k < monthCount; k++) {
    const day = Math.floor(Date.UTC(yy, mm, 1) / 86_400_000);
    if (k % every === 0 && day >= lo) xTicks.push({ day, label: `${MONTHS[mm]} ${String(yy).slice(2)}` });
    if (++mm > 11) {
      mm = 0;
      yy++;
    }
  }
  if (xTicks.length === 0) xTicks.push({ day: lo, label: dayToStr(lo).slice(5) });

  const today = dayNumber(new Date().toISOString().slice(0, 10)) ?? 0;
  const total = curve.values[curve.values.length - 1] ?? 0;

  return (
    <figure className="flex flex-col gap-2 w-full max-w-3xl" data-testid="cost-curve">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Akkumulerede omkostninger fra ${dayToStr(lo)} til ${dayToStr(hi)}, i alt ${kr(total)} kr.`} className="w-full h-auto">
        {yTicks.map((v) => (
          <g key={v}>
            <line x1={M.l} x2={W - M.r} y1={y(v)} y2={y(v)} stroke="#e2e8f0" strokeWidth="1" />
            <text x={M.l - 8} y={y(v) + 3.5} textAnchor="end" fontSize="10" fill="#64748b" fontFamily="monospace">
              {kr(v)}
            </text>
          </g>
        ))}
        {xTicks.map((t) => (
          <text key={t.day} x={x(t.day)} y={H - 10} textAnchor="middle" fontSize="10" fill="#64748b">
            {t.label}
          </text>
        ))}
        {today >= lo && today <= hi && (
          <g>
            <line x1={x(today)} x2={x(today)} y1={M.t} y2={H - M.b} stroke="#f43f5e" strokeWidth="1.5" strokeDasharray="3 3" />
            <text x={x(today) + 4} y={M.t + 9} fontSize="10" fill="#e11d48" fontWeight="700">
              I dag
            </text>
          </g>
        )}
        {baseCurve && <polyline points={points(baseCurve.values)} fill="none" stroke="#94a3b8" strokeWidth="2" strokeDasharray="6 4" strokeLinejoin="round" />}
        <polyline points={points(curve.values)} fill="none" stroke="#0f172a" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      </svg>
      <figcaption className="flex flex-wrap gap-x-5 gap-y-1 text-[11px] font-bold text-slate-500">
        <span className="flex items-center gap-1.5">
          <span className="w-5 h-0.5 bg-slate-900 rounded" /> Nuværende plan
        </span>
        {baseCurve && (
          <span className="flex items-center gap-1.5">
            <span className="w-5 border-t-2 border-dashed border-slate-400" /> Baseline
          </span>
        )}
        <span>Omkostningen fordeles jævnt over hver opgaves varighed.</span>
      </figcaption>
    </figure>
  );
}
