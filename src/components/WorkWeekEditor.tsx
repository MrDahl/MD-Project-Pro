import { Plus, Trash2 } from "lucide-react";
import type { DaySchedule, WeekSchedule } from "../types";
import { exampleWeek, formatTime, hoursOfDay, makeWeek, parseTime } from "../utils/worktime";

interface Props {
  week: WeekSchedule | undefined;
  onChange: (week: WeekSchedule | undefined) => void;
  /** Text for the option without own hours, e.g. "Som projektet" */
  plainLabel: string;
  ownLabel?: string;
}

const timeInput = "bg-white border border-slate-200 rounded-lg p-1.5 text-xs font-bold text-slate-700 outline-none focus:border-slate-500 w-[92px]";

const fmtHours = (h: number) => h.toLocaleString("da-DK", { maximumFractionDigits: 2 });

function DayRow({ label, day, offLabel, onChange }: { label: string; day: DaySchedule | null; offLabel?: string; onChange: (d: DaySchedule | null) => void }) {
  const set = (p: Partial<DaySchedule>) => day && onChange({ ...day, ...p });
  const setTime = (apply: (min: number) => Partial<DaySchedule>) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const m = parseTime(e.target.value);
    if (m !== null) set(apply(m));
  };
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-2.5 flex flex-col gap-2" data-testid="workday-row">
      <div className="flex items-center gap-2 flex-wrap">
        <label className="flex items-center gap-1.5 text-xs font-black text-slate-700 min-w-[84px] cursor-pointer">
          <input
            type="checkbox"
            aria-label={`${label} arbejdsdag`}
            checked={!!day}
            onChange={(e) => onChange(e.target.checked ? { start: 7 * 60, end: 15 * 60, breaks: [] } : null)}
            className="accent-sky-600"
          />
          {label}
        </label>
        {day ? (
          <>
            <input type="time" aria-label={`${label} start`} value={formatTime(day.start)} onChange={setTime((m) => ({ start: m }))} className={timeInput} />
            <span className="text-slate-600 text-xs">til</span>
            <input type="time" aria-label={`${label} slut`} value={formatTime(day.end)} onChange={setTime((m) => ({ end: m }))} className={timeInput} />
            <span className="text-xs font-bold text-slate-600 ml-auto" data-testid="day-hours">
              {fmtHours(hoursOfDay(day))} t
            </span>
          </>
        ) : (
          <span className="text-xs text-slate-600 font-semibold">{offLabel ?? "Fri"}</span>
        )}
      </div>
      {day && (
        <div className="flex flex-col gap-1.5 pl-1">
          {day.breaks.map((b, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-slate-600 w-10">Pause</span>
              <input
                type="time"
                aria-label={`${label} pause start`}
                value={formatTime(b.from)}
                onChange={(e) => {
                  const m = parseTime(e.target.value);
                  if (m !== null) set({ breaks: day.breaks.map((x, j) => (j === i ? { ...x, from: m } : x)) });
                }}
                className={timeInput}
              />
              <span className="text-slate-600 text-xs">til</span>
              <input
                type="time"
                aria-label={`${label} pause slut`}
                value={formatTime(b.to)}
                onChange={(e) => {
                  const m = parseTime(e.target.value);
                  if (m !== null) set({ breaks: day.breaks.map((x, j) => (j === i ? { ...x, to: m } : x)) });
                }}
                className={timeInput}
              />
              <button type="button" aria-label="Fjern pause" onClick={() => set({ breaks: day.breaks.filter((_, j) => j !== i) })} className="p-1 text-slate-300 hover:text-red-500 cursor-pointer">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => {
              const last = day.breaks[day.breaks.length - 1];
              const from = last ? last.to + 120 : Math.min(day.end - 30, day.start + 180);
              set({ breaks: [...day.breaks, { from, to: from + 15 }] });
            }}
            className="self-start text-xs font-extrabold text-sky-700 hover:text-sky-900 flex items-center gap-1 cursor-pointer"
          >
            <Plus className="w-3 h-3" /> Tilføj pause
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Working hours per weekday with breaks. Monday-Thursday share one setting, Friday has its own, and the weekend is off
 * unless switched on (weekend hours only matter for tasks that allow weekend work).
 */
export function WorkWeekEditor({ week, onChange, plainLabel, ownLabel = "Egne arbejdstider med klokkeslæt og pauser" }: Props) {
  const rebuild = (mon: DaySchedule | null, fri: DaySchedule | null, weekend: DaySchedule | null) => {
    const w = makeWeek(mon ?? { start: 7 * 60, end: 15 * 60, breaks: [] }, fri, weekend);
    if (!mon) for (const i of [1, 2, 3, 4]) w[i] = null;
    onChange(w);
  };
  return (
    <div className="flex flex-col gap-2" data-testid="workweek-editor">
      <div className="flex flex-col gap-1.5">
        <label className="flex items-center gap-2 text-xs font-bold text-slate-600 cursor-pointer">
          <input type="radio" checked={!week} onChange={() => onChange(undefined)} className="accent-sky-600" />
          {plainLabel}
        </label>
        <label className="flex items-center gap-2 text-xs font-bold text-slate-600 cursor-pointer">
          <input type="radio" data-testid="workweek-own" checked={!!week} onChange={() => !week && onChange(exampleWeek())} className="accent-sky-600" />
          {ownLabel}
        </label>
      </div>
      {week && (
        <div className="flex flex-col gap-2 bg-slate-50 border border-slate-100 rounded-lg p-2.5">
          <DayRow label="Man-tor" day={week[1]} offLabel="Fri" onChange={(d) => rebuild(d, week[5], week[6])} />
          <DayRow label="Fredag" day={week[5]} onChange={(d) => rebuild(week[1], d, week[6])} />
          <DayRow label="Weekend" day={week[6]} offLabel="Ingen arbejde (kan tillades pr. opgave)" onChange={(d) => rebuild(week[1], week[5], d)} />
        </div>
      )}
    </div>
  );
}
