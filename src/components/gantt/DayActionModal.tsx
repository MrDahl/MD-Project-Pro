import { useState } from "react";
import type { Holiday, WeatherDelay } from "../../types";
import { Calendar, X, ShieldCheck, Trash2, PlusCircle, CloudLightning } from "lucide-react";

interface DayActionModalProps {
  /** The clicked day, "YYYY-MM-DD". */
  date: string;
  holidays: Holiday[];
  weatherDelays: WeatherDelay[];
  onAddHoliday: (date: string, name: string) => void;
  onDeleteHoliday: (idx: number) => void;
  onAddWeatherDelay: (label: string, start: string, end: string) => void;
  onDeleteWeatherDelay: (id: string) => void;
  onClose: () => void;
}

export function DayActionModal({
  date,
  holidays,
  weatherDelays,
  onAddHoliday,
  onDeleteHoliday,
  onAddWeatherDelay,
  onDeleteWeatherDelay,
  onClose,
}: DayActionModalProps) {
  const foundHoliday = holidays.find((h) => h.date === date);
  const foundWeather = weatherDelays.find((wd) => date >= wd.startDate && date <= wd.endDate);

  const [dayHolidayName, setDayHolidayName] = useState(foundHoliday?.name ?? "Lukkedag");
  const [dayWeatherLabel, setDayWeatherLabel] = useState(foundWeather?.label ?? "");
  const [dayWeatherEnd, setDayWeatherEnd] = useState(foundWeather?.endDate ?? date);
  const [dayActionType, setDayActionType] = useState<"holiday" | "weather">(foundWeather ? "weather" : "holiday");

  return (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4" id="day-action-modal">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-sm border border-slate-100 overflow-hidden flex flex-col">
              {/* Modal Header */}
              <div className="bg-slate-900 px-4 py-3 flex justify-between items-center text-white">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-slate-300" />
                  <span className="text-xs font-black uppercase tracking-wider">
                    Valg for {new Date(`${date}T12:00:00`).toLocaleDateString("da-DK", { day: "numeric", month: "long" })}
                  </span>
                </div>
                <button
                  onClick={() => onClose()}
                  className="p-1 hover:bg-white/10 rounded-lg text-white/70 hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Modal Content */}
              <div className="p-4 flex flex-col gap-4">
                <div className="flex rounded-lg bg-slate-100 p-1">
                  <button
                    type="button"
                    onClick={() => setDayActionType("holiday")}
                    className={`flex-1 py-1.5 text-xs font-black rounded-md transition cursor-pointer ${
                      dayActionType === "holiday" ? "bg-white text-slate-800 shadow-2xs" : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    Lukkedag / Ferie
                  </button>
                  <button
                    type="button"
                    onClick={() => setDayActionType("weather")}
                    className={`flex-1 py-1.5 text-xs font-black rounded-md transition cursor-pointer ${
                      dayActionType === "weather" ? "bg-white text-slate-800 shadow-2xs" : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    Uvejr / Vejrforhold
                  </button>
                </div>

                {dayActionType === "holiday" ? (
                  <div className="flex flex-col gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Navngiv lukkedag / ferie</label>
                      <input
                        type="text"
                        value={dayHolidayName}
                        onChange={(e) => setDayHolidayName(e.target.value)}
                        placeholder="F.eks. Grundlovsdag..."
                        className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs font-bold text-slate-700 outline-none focus:border-slate-500"
                      />
                    </div>

                    {holidays.some((h) => h.date === date) ? (
                      <div className="flex flex-col gap-2">
                        <div className="text-[10px] text-purple-700 bg-purple-50 p-2 rounded-lg font-bold border border-purple-100 flex items-center gap-1.5">
                          <ShieldCheck className="w-4 h-4" />
                          <span>Denne dag er en registreret lukkedag ({holidays.find(h => h.date === date)?.name}).</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const idx = holidays.findIndex((h) => h.date === date);
                            if (idx !== -1) onDeleteHoliday(idx);
                            onClose();
                          }}
                          className="w-full py-2.5 bg-red-50 hover:bg-red-100 text-red-650 rounded-lg text-xs font-extrabold flex items-center justify-center gap-1.5 border border-red-200 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Fjern lukkedag</span>
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          onAddHoliday(date, dayHolidayName.trim() || "Lukkedag");
                          onClose();
                        }}
                        className="w-full py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-extrabold flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                      >
                        <PlusCircle className="w-3.5 h-3.5" />
                        <span>Gem som lukkedag</span>
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Navngiv vejrforhold</label>
                      <input
                        type="text"
                        value={dayWeatherLabel}
                        onChange={(e) => setDayWeatherLabel(e.target.value)}
                        placeholder="F.eks. Kraftig sne, Skybrud..."
                        className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs font-bold text-slate-700 outline-none focus:border-slate-500"
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Slutdato for vejrforhold</label>
                      <input
                        type="date"
                        value={dayWeatherEnd}
                        onChange={(e) => setDayWeatherEnd(e.target.value)}
                        min={date}
                        className="bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-bold text-slate-700 outline-none focus:border-slate-500"
                      />
                    </div>

                    {weatherDelays.some((wd) => date >= wd.startDate && date <= wd.endDate) ? (
                      <div className="flex flex-col gap-2">
                        <div className="text-[10px] text-sky-700 bg-sky-50 p-2 rounded-lg font-bold border border-sky-100 flex items-center gap-1.5">
                          <CloudLightning className="w-4 h-4" />
                          <span>Vejrspildsdag aktiv på denne dato.</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const delay = weatherDelays.find((wd) => date >= wd.startDate && date <= wd.endDate);
                            if (delay) onDeleteWeatherDelay(delay.id);
                            onClose();
                          }}
                          className="w-full py-2.5 bg-red-50 hover:bg-red-100 text-red-650 rounded-lg text-xs font-extrabold flex items-center justify-center gap-1.5 border border-red-200 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Fjern vejrforhold</span>
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          onAddWeatherDelay(
                            dayWeatherLabel.trim() || "Uvejr (vejrspild)",
                            date,
                            dayWeatherEnd || date
                          );
                          onClose();
                        }}
                        className="w-full py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-extrabold flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                      >
                        <PlusCircle className="w-3.5 h-3.5" />
                        <span>Gem vejrforhold</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
  );
}
