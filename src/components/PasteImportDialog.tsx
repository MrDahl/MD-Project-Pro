import { useMemo, useState } from "react";
import { ClipboardPaste, X, AlertTriangle } from "lucide-react";
import type { Stage, Trade } from "../types";
import { useEscapeKey } from "./useEscapeKey";
import { importFromText, type ImportResult } from "../utils/pasteImport";

interface Props {
  trades: Trade[];
  stages: Stage[];
  startDate: string;
  onImport: (result: ImportResult) => void;
  onClose: () => void;
}

const EXAMPLE = "Opgave\tVarighed (dage)\tForgænger\tFaggruppe\tEtape\nUdgravning\t4\t\tEntreprenør\tEtape 1\nFundament\t6\tUdgravning\tBeton\tEtape 1";

export function PasteImportDialog({ trades, stages, startDate, onImport, onClose }: Props) {
  useEscapeKey(onClose);
  const [text, setText] = useState("");
  const result = useMemo(() => (text.trim() ? importFromText(text, { trades, stages, startDate }) : null), [text, trades, stages, startDate]);

  return (
    <div className="fixed inset-0 z-[70] bg-slate-900/50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        id="paste-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="paste-title"
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-2xl w-full p-5 flex flex-col gap-3 max-h-[92vh] overflow-y-auto"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="paste-title" className="text-base font-black text-slate-900 flex items-center gap-2">
              <ClipboardPaste className="w-5 h-5 text-sky-600" /> Indsæt opgaver fra Excel
            </h2>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              Markér rækker i Excel (gerne med overskrifter), kopiér og indsæt herunder. Kolonner genkendes på overskriften: <strong>Opgave, Varighed, Forgænger(e), Faggruppe, Etape, Start, ID</strong>. Skriver du "uger" i varigheden, regnes 1 uge som 5 dage. Forgænger kan være et ID, et rækkenummer eller opgavens navn (fx <em>P03, P04SS+2</em>).
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Luk" className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <textarea
          aria-label="Indsæt fra Excel"
          data-testid="paste-text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={EXAMPLE}
          rows={7}
          className="w-full font-mono text-[11px] p-2.5 rounded-lg border border-slate-200 bg-slate-50 outline-none focus:border-slate-500 whitespace-pre"
        />

        {result && (
          <div data-testid="paste-preview" className="flex flex-col gap-2">
            <div className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700">
              {result.tasks.length} opgaver
              {result.newTrades.length > 0 && <> &middot; {result.newTrades.length} nye faggrupper ({result.newTrades.map((t) => t.name).join(", ")})</>}
              {result.newStages.length > 0 && <> &middot; {result.newStages.length} nye etaper ({result.newStages.map((s) => s.name).join(", ")})</>}
            </div>
            {result.tasks.length > 0 && (
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-[11px]">
                  <thead className="bg-slate-50 text-slate-400 uppercase text-[9px] tracking-wider">
                    <tr>
                      <th className="text-left p-2">#</th>
                      <th className="text-left p-2">Opgave</th>
                      <th className="text-right p-2">Dage</th>
                      <th className="text-right p-2">Forgængere</th>
                      <th className="text-left p-2">Faggrupper</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.tasks.slice(0, 8).map((t, i) => (
                      <tr key={t.id} className="border-t border-slate-100">
                        <td className="p-2 text-slate-400">{i + 1}</td>
                        <td className="p-2 font-semibold text-slate-700">{t.title}</td>
                        <td className="p-2 text-right font-mono">{t.duration}</td>
                        <td className="p-2 text-right font-mono">{(t.dependencies || []).length}</td>
                        <td className="p-2 text-slate-500">{t.tradeIds.map((id) => [...trades, ...result.newTrades].find((x) => x.id === id)?.name).join(", ")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {result.tasks.length > 8 && <div className="p-2 text-[10px] text-slate-400 border-t border-slate-100">… og {result.tasks.length - 8} flere</div>}
              </div>
            )}
            {result.warnings.length > 0 && (
              <ul data-testid="paste-warnings" className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-xl p-2.5 flex flex-col gap-1 max-h-32 overflow-y-auto">
                {result.warnings.slice(0, 30).map((w, i) => (
                  <li key={i} className="flex gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px" />
                    <span>{w}</span>
                  </li>
                ))}
                {result.warnings.length > 30 && <li>… og {result.warnings.length - 30} flere</li>}
              </ul>
            )}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-3.5 py-2 rounded-lg text-xs font-extrabold text-slate-600 bg-slate-100 hover:bg-slate-200 cursor-pointer">
            Annuller
          </button>
          <button
            type="button"
            data-testid="paste-confirm"
            disabled={!result || result.tasks.length === 0}
            onClick={() => result && onImport(result)}
            className="px-4 py-2 rounded-lg text-xs font-extrabold text-white bg-sky-600 hover:bg-sky-700 disabled:opacity-50 cursor-pointer"
          >
            Tilføj {result && result.tasks.length > 0 ? `${result.tasks.length} opgaver` : "opgaver"} til projektet
          </button>
        </div>
      </div>
    </div>
  );
}
