import { useMemo, useState } from "react";
import { FileText, X } from "lucide-react";
import { useEscapeKey } from "../../useEscapeKey";
import { DEFAULT_PDF_OPTIONS, approxMeasure, layoutPages, selectRows, type Paper, type PdfInput, type PdfOptions } from "./layout";

interface Props {
  input: PdfInput;
  hasBaseline: boolean;
  busy: boolean;
  error: string | null;
  onExport: (opts: PdfOptions) => void;
  onClose: () => void;
}

const field = "bg-white border border-slate-200 rounded-lg p-2 text-xs font-bold text-slate-700 outline-none focus:border-slate-500";

export function PdfExportDialog({ input, hasBaseline, busy, error, onExport, onClose }: Props) {
  useEscapeKey(onClose);
  const [opts, setOpts] = useState<PdfOptions>({ ...DEFAULT_PDF_OPTIONS, baseline: hasBaseline });
  const set = (patch: Partial<PdfOptions>) => setOpts((o) => ({ ...o, ...patch }));

  // Estimate of the result (the real text widths are only known while generating)
  const estimate = useMemo(() => {
    const pages = layoutPages(input, opts, approxMeasure);
    const w = Math.round(Math.max(...pages.map((p) => p.w)));
    const h = Math.round(Math.max(...pages.map((p) => p.h)));
    const tasks = selectRows(input, opts.scope).taskCount;
    return { pages: pages.length, w, h, tasks };
  }, [input, opts]);

  const fmtSize = (mm: number) => (mm >= 1000 ? `${(mm / 1000).toFixed(2).replace(".", ",")} m` : `${mm} mm`);

  return (
    <div className="fixed inset-0 z-[70] bg-slate-900/50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        id="pdf-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pdf-dialog-title"
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-lg w-full p-5 flex flex-col gap-4 max-h-[92vh] overflow-y-auto"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="pdf-dialog-title" className="text-base font-black text-slate-900 flex items-center gap-2">
              <FileText className="w-5 h-5 text-sky-600" /> Gem tidsplan som PDF
            </h2>
            <p className="text-xs text-slate-600 mt-1 leading-relaxed">
              Vektor-PDF med kalender, opgaver og faggrupper ved bjælkerne. Tekst og streger er knivskarpe, også ved stor udskrift.
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Luk" className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-xs font-black text-slate-600">
            Omfang
            <select aria-label="Omfang" value={opts.scope} onChange={(e) => set({ scope: e.target.value })} className={field}>
              <option value="all">Hele projektet</option>
              {input.stages.map((s) => (
                <option key={s.id} value={s.id}>
                  Kun {s.name}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-xs font-black text-slate-600">
            Papir
            <select aria-label="Papir" value={opts.paper} onChange={(e) => set({ paper: e.target.value as Paper })} className={field}>
              <option value="auto">Automatisk størrelse (ét stort ark)</option>
              <option value="A4">A4</option>
              <option value="A3">A3</option>
              <option value="A2">A2</option>
              <option value="A1">A1</option>
              <option value="A0">A0</option>
            </select>
          </label>

          {opts.paper === "auto" ? (
            <label className="flex flex-col gap-1 text-xs font-black text-slate-600">
              Detaljegrad
              <select aria-label="Detaljegrad" value={opts.dayWidth} onChange={(e) => set({ dayWidth: Number(e.target.value) })} className={field}>
                <option value={5}>Detaljeret (5 mm pr. dag)</option>
                <option value={3}>Kompakt (3 mm pr. dag)</option>
                <option value={1.5}>Overblik (1,5 mm pr. dag)</option>
              </select>
            </label>
          ) : (
            <label className="flex flex-col gap-1 text-xs font-black text-slate-600">
              Retning
              <select aria-label="Retning" value={opts.portrait ? "p" : "l"} onChange={(e) => set({ portrait: e.target.value === "p" })} className={field}>
                <option value="l">Liggende</option>
                <option value="p">Stående</option>
              </select>
            </label>
          )}

          <label className="flex flex-col gap-1 text-xs font-black text-slate-600">
            Opgaver pr. side (maks)
            <select aria-label="Opgaver pr. side" value={opts.maxTasks} onChange={(e) => set({ maxTasks: Number(e.target.value) })} className={field}>
              <option value={300}>300</option>
              <option value={150}>150</option>
              <option value={75}>75</option>
              <option value={40}>40</option>
            </select>
          </label>
        </div>

        <div className="flex flex-wrap gap-x-5 gap-y-2">
          <label className="flex items-center gap-1.5 text-xs font-bold text-slate-600 cursor-pointer">
            <input type="checkbox" checked={opts.arrows} onChange={(e) => set({ arrows: e.target.checked })} className="accent-sky-600" />
            Afhængighedspile
          </label>
          <label className={`flex items-center gap-1.5 text-xs font-bold ${hasBaseline ? "text-slate-600 cursor-pointer" : "text-slate-300"}`}>
            <input type="checkbox" disabled={!hasBaseline} checked={opts.baseline && hasBaseline} onChange={(e) => set({ baseline: e.target.checked })} className="accent-sky-600" />
            Baseline {hasBaseline ? "" : "(ikke gemt)"}
          </label>
        </div>

        <div data-testid="pdf-estimate" className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-600 leading-relaxed">
          {estimate.tasks} opgaver &rarr; ca. <strong>{estimate.pages}</strong> {estimate.pages === 1 ? "side" : "sider"}, {fmtSize(estimate.w)} &times; {fmtSize(estimate.h)}
          {opts.paper === "auto" && estimate.w > 1200 ? " - stort ark: vælg 'Overblik' eller én etape ad gangen for mindre format." : ""}
        </div>

        {error && <p className="text-xs font-bold text-red-600">{error}</p>}

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-3.5 py-2 rounded-lg text-xs font-extrabold text-slate-600 bg-slate-100 hover:bg-slate-200 cursor-pointer">
            Annuller
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => onExport(opts)}
            className="px-4 py-2 rounded-lg text-xs font-extrabold text-white bg-sky-600 hover:bg-sky-700 disabled:opacity-60 cursor-pointer"
          >
            {busy ? "Genererer…" : "Gem PDF"}
          </button>
        </div>
      </div>
    </div>
  );
}
