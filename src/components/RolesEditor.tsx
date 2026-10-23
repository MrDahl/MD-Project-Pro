import { Plus, Trash2, Users } from "lucide-react";
import type { Role } from "../types";
import { newId } from "../utils/roles";

interface Props {
  roles: Role[];
  onChange: (roles: Role[]) => void;
}

const input = "bg-white border border-slate-200 rounded-lg p-2 text-xs font-bold text-slate-700 outline-none focus:border-slate-500 min-w-0";

/** Sub-resources of a trade: e.g. "Svend" x 2 at 450 kr/t. */
export function RolesEditor({ roles, onChange }: Props) {
  const update = (id: string, patch: Partial<Role>) => onChange(roles.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const total = roles.reduce((s, r) => s + r.rate * r.count, 0);
  return (
    <div className="flex flex-col gap-2" data-testid="roles-editor">
      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
        <Users className="w-3.5 h-3.5 text-slate-400" />
        <span>Underresurser (medarbejdere)</span>
      </label>
      <p className="text-[10px] text-slate-400 font-medium leading-relaxed">
        Fx 1 overmontør, 2 svende og 3 lærlinge med hver sin timepris. På opgaverne kan du så bemande hver aktivitet (kabeltræk, rillefræsning ...) og få prisen pr. rolle.
      </p>
      {roles.length > 0 && (
        <div className="bg-slate-50 border border-slate-100 rounded-lg p-2.5 flex flex-col gap-1.5">
          <div className="grid grid-cols-[1fr_64px_88px_32px] gap-1.5 text-[9px] font-black uppercase tracking-wider text-slate-400 px-0.5">
            <span>Rolle</span>
            <span>Antal</span>
            <span>kr./t pr. person</span>
            <span />
          </div>
          {roles.map((r) => (
            <div key={r.id} className="grid grid-cols-[1fr_64px_88px_32px] gap-1.5 items-center" data-testid="role-row">
              <input aria-label="Rollenavn" value={r.name} onChange={(e) => update(r.id, { name: e.target.value })} placeholder="Svend" className={input} />
              <input aria-label="Antal" type="number" min={1} value={r.count} onChange={(e) => update(r.id, { count: Math.max(1, parseInt(e.target.value) || 1) })} className={input} />
              <input aria-label="Timepris" type="number" min={0} value={r.rate} onChange={(e) => update(r.id, { rate: Math.max(0, parseInt(e.target.value) || 0) })} className={input} />
              <button type="button" aria-label="Fjern rolle" onClick={() => onChange(roles.filter((x) => x.id !== r.id))} className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 cursor-pointer">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
          <div className="text-[10px] font-bold text-slate-500 pt-1 border-t border-slate-200">
            Hele holdet: {roles.reduce((s, r) => s + r.count, 0)} personer &middot; {total.toLocaleString("da-DK")} kr./t
          </div>
        </div>
      )}
      <button
        type="button"
        data-testid="add-role"
        onClick={() => onChange([...roles, { id: newId("role"), name: "", count: 1, rate: 400 }])}
        className="self-start px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-[11px] font-extrabold text-slate-700 flex items-center gap-1 cursor-pointer"
      >
        <Plus className="w-3.5 h-3.5" /> Tilføj underresurse
      </button>
    </div>
  );
}
