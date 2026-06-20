import React, { useState, useEffect } from "react";
import { Trade } from "../types";
import { Save, Ban, Plus, Percent, Coins, Palette } from "lucide-react";

interface TradeFormProps {
  trades: Trade[];
  editTradeId: string | null;
  onSave: (trade: Trade) => void;
  onCancel: () => void;
}

const PRESET_COLORS = [
  "#3b82f6", // Blue
  "#10b981", // Emerald
  "#f59e0b", // Amber
  "#ef4444", // Red
  "#8b5cf6", // Purple
  "#ec4899", // Pink
  "#14b8a6", // Teal
  "#f97316", // Orange
  "#6366f1", // Indigo
];

export function TradeForm({ trades, editTradeId, onSave, onCancel }: TradeFormProps) {
  const [name, setName] = useState("");
  const [rate, setRate] = useState<number>(300);
  const [isFixedPrice, setIsFixedPrice] = useState(false);
  const [weekendSupplement, setWeekendSupplement] = useState<number>(50);
  const [holidaySupplement, setHolidaySupplement] = useState<number>(100);
  const [color, setColor] = useState("#3b82f6");

  useEffect(() => {
    if (editTradeId) {
      const tr = trades.find((x) => x.id === editTradeId);
      if (tr) {
        setName(tr.name);
        setRate(tr.rate);
        setIsFixedPrice(tr.isFixedPrice);
        setWeekendSupplement(tr.weekendSupplement);
        setHolidaySupplement(tr.holidaySupplement);
        setColor(tr.color);
      }
    } else {
      resetForm();
    }
  }, [editTradeId, trades]);

  const resetForm = () => {
    setName("");
    setRate(300);
    setIsFixedPrice(false);
    setWeekendSupplement(50);
    setHolidaySupplement(100);
    setColor("#3b82f6");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    onSave({
      id: editTradeId || "trade-" + Date.now(),
      name,
      rate,
      isFixedPrice,
      weekendSupplement: isFixedPrice ? 0 : weekendSupplement,
      holidaySupplement: isFixedPrice ? 0 : holidaySupplement,
      color,
    });
    resetForm();
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-slate-100 rounded-xl p-5 shadow-xs flex flex-col gap-4 select-none">
      <h3 className="text-base font-bold text-slate-800 border-b border-slate-100 pb-2 flex items-center gap-1.5">
        <Plus className="w-5 h-5 text-slate-750" />
        <span>{editTradeId ? "Rediger Faggruppe / Resurse" : "Opret Ny Faggruppe / Resurse"}</span>
      </h3>

      {/* Row 1: Name */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Faggruppe / Resurse navn</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="F.eks. Skurvogn, Elektriker (svend), Murer..."
          className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs font-semibold text-slate-700 outline-none focus:border-slate-500"
          required
        />
      </div>

      {/* Row 2: Fixed price toggle */}
      <label className="flex items-center gap-2 text-xs font-bold text-slate-600 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={isFixedPrice}
          onChange={(e) => setIsFixedPrice(e.target.checked)}
          className="w-4 h-4 accent-slate-700"
        />
        <span>Fast pris / Engangsbeløb (Beregnes pr. tilknyttet opgave i stedet for timepris dagspris)</span>
      </label>

      {/* Row 3: Standard Rate Expense */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
          <Coins className="w-3.5 h-3.5 text-slate-400" />
          <span>{isFixedPrice ? "Fast pris pr. tilknyttet opgave (kr.)" : "Standard timepris (kr./t)"}</span>
        </label>
        <input
          type="number"
          value={rate}
          onChange={(e) => setRate(Math.max(0, parseInt(e.target.value) || 0))}
          className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs font-bold text-slate-700 outline-none focus:border-slate-500"
          min={0}
          required
        />
      </div>

      {/* Row 4: Weekend/Holiday Supplements percentages - only if hourly rate */}
      {!isFixedPrice && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-3.5 rounded-lg border border-slate-100">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-slate-500 flex items-center gap-1">
              <Percent className="w-3.5 h-3.5 text-slate-400" />
              <span>Weekend-tillæg i %</span>
            </label>
            <input
              type="number"
              value={weekendSupplement}
              onChange={(e) => setWeekendSupplement(Math.max(0, parseInt(e.target.value) || 0))}
              placeholder="F.eks. 50"
              className="bg-white border border-slate-200 rounded-lg p-2.5 text-xs font-bold text-slate-700 outline-none focus:border-slate-500"
              min={0}
              required
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-slate-500 flex items-center gap-1">
              <Percent className="w-3.5 h-3.5 text-slate-400" />
              <span>Helligdags-tillæg i %</span>
            </label>
            <input
              type="number"
              value={holidaySupplement}
              onChange={(e) => setHolidaySupplement(Math.max(0, parseInt(e.target.value) || 0))}
              placeholder="F.eks. 100"
              className="bg-white border border-slate-200 rounded-lg p-2.5 text-xs font-bold text-slate-700 outline-none focus:border-slate-500"
              min={0}
              required
            />
          </div>
        </div>
      )}

      {/* Row 5: Preset colors selections */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
          <Palette className="w-3.5 h-3.5 text-slate-400" />
          <span>Vælg farve til tidsplan</span>
        </label>
        <div className="flex flex-wrap gap-2 bg-slate-50 p-2.5 rounded-lg border border-slate-100 justify-between items-center">
          <div className="flex flex-wrap gap-1.5">
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={`w-6 h-6 rounded-full border cursor-pointer hover:scale-110 active:scale-95 transition ${
                  color === c ? "border-slate-900 ring-2 ring-slate-500/25 shadow-xs" : "border-transparent"
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>

          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="w-8 h-8 rounded border-0 cursor-pointer p-0 bg-transparent shrink-0"
            title="Vælg tilpasset farve"
          />
        </div>
      </div>

      {/* Form buttons */}
      <div className="flex gap-2 border-t border-slate-100 pt-3">
        <button
          type="submit"
          className="flex-1 bg-slate-700 hover:bg-slate-800 active:bg-slate-900 text-white text-xs font-extrabold py-3 rounded-lg flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
        >
          <Save className="w-4 h-4" />
          <span>{editTradeId ? "Opdater Resurse" : "Tilføj Resurse"}</span>
        </button>

        {editTradeId && (
          <button
            type="button"
            onClick={onCancel}
            className="px-4 bg-white hover:bg-slate-55 border border-slate-200 rounded-lg text-xs font-bold text-slate-500 cursor-pointer flex items-center justify-center gap-1"
          >
            <Ban className="w-4 h-4" />
            <span>Annuller</span>
          </button>
        )}
      </div>
    </form>
  );
}
