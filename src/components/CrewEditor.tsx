import { Plus, Trash2, HardHat } from "lucide-react";
import type { Assignment, Trade } from "../types";
import { crewHourly, newId } from "../utils/roles";

interface Props {
  trades: Trade[]; // the trades chosen on the task
  assignments: Assignment[];
  onChange: (assignments: Assignment[]) => void;
}

const input = "bg-white border border-slate-200 rounded-lg p-1.5 text-xs font-bold text-slate-700 outline-none focus:border-slate-500 min-w-0";

/** Crew per activity inside a task, for trades that have sub-resources. */
export function CrewEditor({ trades, assignments, onChange }: Props) {
  const withRoles = trades.filter((t) => (t.roles || []).length > 0 && !t.isFixedPrice);
  if (withRoles.length === 0) return null;

  const patch = (id: string, p: Partial<Assignment>) => onChange(assignments.map((a) => (a.id === id ? { ...a, ...p } : a)));

  return (
    <div className="flex flex-col gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200" data-testid="crew-editor">
      <div>
        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
          <HardHat className="w-3.5 h-3.5 text-slate-400" />
          <span>Bemanding pr. aktivitet</span>
        </label>
        <p className="text-[10px] text-slate-400 font-medium leading-relaxed mt-1">
          Del opgaven op i aktiviteter og vælg hvem der udfører dem. Prisen beregnes ud fra rollernes timepriser i stedet for faggruppens standardtakst.
        </p>
      </div>

      {withRoles.map((tr) => {
        const list = assignments.filter((a) => a.tradeId === tr.id);
        return (
          <div key={tr.id} className="flex flex-col gap-2">
            <div className="text-[11px] font-black text-slate-700 flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: tr.color }} />
              {tr.name}
            </div>
            {list.map((a) => (
              <div key={a.id} className="bg-white border border-slate-200 rounded-lg p-2.5 flex flex-col gap-2" data-testid="assignment">
                <div className="flex gap-1.5">
                  <input aria-label="Aktivitet" value={a.label} onChange={(e) => patch(a.id, { label: e.target.value })} placeholder="Aktivitet, fx Kabeltræk" className={`${input} flex-1`} />
                  <select
                    aria-label="Andel af tiden"
                    value={a.hours !== undefined ? "hours" : String(a.percent ?? 100)}
                    onChange={(e) => (e.target.value === "hours" ? patch(a.id, { hours: a.hours ?? 2 }) : patch(a.id, { hours: undefined, percent: Number(e.target.value) }))}
                    className={input}
                    title="Hvor meget af opgavens arbejdstid er holdet optaget?"
                  >
                    {[100, 75, 50, 25, 10].map((p) => (
                      <option key={p} value={p}>
                        {p}% af tiden
                      </option>
                    ))}
                    <option value="hours">fast antal timer</option>
                  </select>
                  {a.hours !== undefined && (
                    <input
                      type="number"
                      aria-label="Timer pr. person"
                      title="Timer pr. person i alt"
                      min={0.25}
                      step={0.25}
                      value={a.hours}
                      onChange={(e) => patch(a.id, { hours: Math.max(0, parseFloat(e.target.value) || 0) })}
                      className={`${input} w-16`}
                    />
                  )}
                  <button type="button" aria-label="Fjern aktivitet" onClick={() => onChange(assignments.filter((x) => x.id !== a.id))} className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 cursor-pointer">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                {a.crew.map((c, ci) => {
                  const role = tr.roles!.find((r) => r.id === c.roleId);
                  return (
                    <div key={ci} className="flex items-center gap-1.5 pl-3">
                      <input
                        aria-label="Antal personer"
                        type="number"
                        min={1}
                        value={c.count}
                        onChange={(e) => patch(a.id, { crew: a.crew.map((x, i) => (i === ci ? { ...x, count: Math.max(1, parseInt(e.target.value) || 1) } : x)) })}
                        className={`${input} w-14`}
                      />
                      <select aria-label="Rolle" value={c.roleId} onChange={(e) => patch(a.id, { crew: a.crew.map((x, i) => (i === ci ? { ...x, roleId: e.target.value } : x)) })} className={`${input} flex-1`}>
                        {tr.roles!.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.name} (har {r.count}, {r.rate} kr./t)
                          </option>
                        ))}
                      </select>
                      {role && c.count > role.count && <span className="text-[10px] font-bold text-amber-600">kun {role.count} ansat</span>}
                      <button type="button" aria-label="Fjern person" onClick={() => patch(a.id, { crew: a.crew.filter((_, i) => i !== ci) })} className="p-1 rounded text-slate-300 hover:text-red-500 cursor-pointer">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
                <div className="flex items-center justify-between pl-3">
                  <button
                    type="button"
                    onClick={() => patch(a.id, { crew: [...a.crew, { roleId: tr.roles![0].id, count: 1 }] })}
                    className="text-[10px] font-extrabold text-sky-700 hover:text-sky-900 flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" /> Tilføj person
                  </button>
                  <span className="text-[10px] font-bold text-slate-400">
                    {a.hours !== undefined
                      ? `${Math.round(crewHourly(a, tr.roles) * a.hours).toLocaleString("da-DK")} kr. i alt`
                      : `${Math.round(crewHourly(a, tr.roles) * ((a.percent ?? 100) / 100)).toLocaleString("da-DK")} kr./t`}
                  </span>
                </div>
              </div>
            ))}
            <button
              type="button"
              data-testid="add-assignment"
              onClick={() => onChange([...assignments, { id: newId("asg"), tradeId: tr.id, label: "", crew: [{ roleId: tr.roles![0].id, count: 1 }], percent: 100 }])}
              className="self-start px-3 py-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-[11px] font-extrabold text-slate-700 flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> Tilføj aktivitet
            </button>
          </div>
        );
      })}
    </div>
  );
}
