import React, { useState } from "react";
import { AppData, Trade, Stage, ProjectInfo, Settings } from "../types";
import { 
  Building, 
  Calendar, 
  Layers, 
  Users, 
  Check, 
  ArrowRight, 
  ArrowLeft, 
  Play, 
  Info, 
  Sparkles, 
  Clock, 
  HelpCircle,
  MapPin,
  Briefcase
} from "lucide-react";

interface WizardProps {
  onComplete: (completedData: {
    projectInfo: ProjectInfo;
    startDate: string;
    settings: Settings;
    holidays: string[];
    stages: Stage[];
    trades: Trade[];
    includeDanishHolidays?: boolean;
  }) => void;
  onClose?: () => void;
  isOpen: boolean;
}

export function Wizard({ onComplete, onClose, isOpen }: WizardProps) {
  const [step, setStep] = useState(1);
  const totalSteps = 5;

  // Step 1: Project Info
  const [projectName, setProjectName] = useState("Renovering Hovedgade");
  const [address, setAddress] = useState("Hovedgade 12, 8000 Aarhus C");
  const [customer, setCustomer] = useState("Vejle Boligselskab A/S");
  const [manager, setManager] = useState("Byggeleder Olsen");
  const [workHoursPerDay, setWorkHoursPerDay] = useState(7.4);

  // Step 2: Calendar & Start Date
  const [startDate, setStartDate] = useState("2026-06-22"); // Default upcoming Monday
  const [includeSummerHoliday, setIncludeSummerHoliday] = useState(false); // Automagic summer holiday (e.g., July 13th to July 31st 2026)
  const [includeDanishHolidays, setIncludeDanishHolidays] = useState(true); // Automatically load Danish public holidays
  const [customHolidays, setCustomHolidays] = useState<string[]>([]);
  const [newHoliday, setNewHoliday] = useState("");

  // Step 3: Stages (Etaper)
  const [includeEtaper, setIncludeEtaper] = useState({
    prep: true,
    raw: true,
    finish: true,
  });
  
  // Custom dates for selected etaper relative to start date
  const [stageDates, setStageDates] = useState({
    prepStartDate: "2026-06-22",
    prepEndDate: "2026-07-05", // 2 weeks
    rawStartDate: "2026-07-06",
    rawEndDate: "2026-08-16",  // 6 weeks
    finishStartDate: "2026-08-17",
    finishEndDate: "2026-09-04", // ~3 weeks
  });

  // Step 4: Trades (Faggrupper)
  const [selectedTrades, setSelectedTrades] = useState({
    carpenter: true,
    electrician: true,
    plumber: true,
    groundConcrete: true,
    machineRent: false,
  });

  if (!isOpen) return null;

  const handleNext = () => {
    if (step < totalSteps) {
      setStep(step + 1);
    } else {
      handleFinish();
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  const addCustomHoliday = () => {
    if (newHoliday && !customHolidays.includes(newHoliday)) {
      setCustomHolidays([...customHolidays, newHoliday].sort());
      setNewHoliday("");
    }
  };

  const removeCustomHoliday = (date: string) => {
    setCustomHolidays(customHolidays.filter(d => d !== date));
  };

  const handleFinish = () => {
    // 1. Prepare Holidays
    const holidays = [...customHolidays];
    if (includeSummerHoliday) {
      // Auto-populate industrial summer weeks (approx weeks 29, 30, 31 in 2026: July 13th to July 31st inclusive, working days)
      const summerDays = [
        "2026-07-13", "2026-07-14", "2026-07-15", "2026-07-16", "2026-07-17",
        "2026-07-20", "2026-07-21", "2026-07-22", "2026-07-23", "2026-07-24",
        "2026-07-27", "2026-07-28", "2026-07-29", "2026-07-30", "2026-07-31"
      ];
      summerDays.forEach(day => {
        if (!holidays.includes(day)) {
          holidays.push(day);
        }
      });
    }

    // 2. Prepare Stages (Etaper)
    const stages: Stage[] = [];
    if (includeEtaper.prep) {
      stages.push({
        id: "stage-prep-" + Date.now(),
        name: "Etape 1: Forberedelse & Udgravning",
        color: "#5c6e75", // Sleek neutral zinc/steel
        startDate: stageDates.prepStartDate,
        endDate: stageDates.prepEndDate,
      });
    }
    if (includeEtaper.raw) {
      stages.push({
        id: "stage-raw-" + Date.now(),
        name: "Etape 2: Råhus & Indvendigt",
        color: "#d97706", // Amber
        startDate: stageDates.rawStartDate,
        endDate: stageDates.rawEndDate,
      });
    }
    if (includeEtaper.finish) {
      stages.push({
        id: "stage-finish-" + Date.now(),
        name: "Etape 3: Forbrugere & Aflevering",
        color: "#0d9488", // Teal
        startDate: stageDates.finishStartDate,
        endDate: stageDates.finishEndDate,
      });
    }

    // 3. Prepare Trades (Faggrupper)
    const trades: Trade[] = [];
    if (selectedTrades.carpenter) {
      trades.push({
        id: "tr-carpenter-" + Date.now(),
        name: "Tømrer (Svend)",
        rate: 320,
        isFixedPrice: false,
        weekendSupplement: 50,
        holidaySupplement: 100,
        color: "#8b5cf6" // Purplish
      });
    }
    if (selectedTrades.electrician) {
      trades.push({
        id: "tr-electrician-" + Date.now(),
        name: "Elektriker (Mester)",
        rate: 345,
        isFixedPrice: false,
        weekendSupplement: 50,
        holidaySupplement: 100,
        color: "#3b82f6" // Soft blue
      });
    }
    if (selectedTrades.plumber) {
      trades.push({
        id: "tr-plumber-" + Date.now(),
        name: "Plumb & VVS",
        rate: 360,
        isFixedPrice: false,
        weekendSupplement: 60,
        holidaySupplement: 100,
        color: "#10b981" // Emerald
      });
    }
    if (selectedTrades.groundConcrete) {
      trades.push({
        id: "tr-ground-" + Date.now(),
        name: "Jord & Beton",
        rate: 380,
        isFixedPrice: false,
        weekendSupplement: 45,
        holidaySupplement: 100,
        color: "#ec4899"
      });
    }
    if (selectedTrades.machineRent) {
      trades.push({
        id: "tr-machine-" + Date.now(),
        name: "Leje af Gravemaskine",
        rate: 4500,
        isFixedPrice: true,
        weekendSupplement: 0,
        holidaySupplement: 0,
        color: "#f97316"
      });
    }

    // 4. Fire Complete Action
    onComplete({
      projectInfo: {
        projectName: projectName.trim() || "Nyt Byggeprojekt",
        address: address.trim(),
        customer: customer.trim(),
        manager: manager.trim(),
      },
      startDate: startDate || "2026-06-22",
      settings: {
        workHoursPerDay: workHoursPerDay || 7.4,
      },
      holidays: holidays.sort(),
      stages: stages,
      trades: trades,
      includeDanishHolidays: includeDanishHolidays,
    });
  };

  return (
    <div className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs select-none">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Wizard Header bar */}
        <div className="bg-slate-800 text-white px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-slate-700 flex items-center justify-center text-slate-100 font-extrabold text-sm border border-slate-600/40">
              📌
            </div>
            <div>
              <h2 className="text-sm font-black tracking-tight mb-0">Opsætningsvejledning</h2>
              <p className="text-[10px] text-slate-450 font-bold leading-none mt-1">Konfigurer dit næste byggeprojekt trin-for-trin</p>
            </div>
          </div>
          <div className="text-right text-xs font-mono font-bold text-slate-400">
            Trin {step} af {totalSteps}
          </div>
        </div>

        {/* Progress horizontal indicator bar */}
        <div className="w-full bg-slate-100 h-1 flex">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div
              key={i}
              className={`flex-1 transition-all duration-300 ${
                i + 1 <= step ? "bg-slate-700" : "bg-slate-200"
              }`}
            />
          ))}
        </div>

        {/* Scrollable multi-step content */}
        <div className="flex-1 p-6 md:p-8 overflow-y-auto flex flex-col">
          
          {/* STEP 1: Basisforhold */}
          {step === 1 && (
            <div className="flex flex-col gap-4 animate-fadeIn">
              <div className="flex gap-3 mb-2">
                <span className="text-2xl">🏗️</span>
                <div>
                  <h3 className="text-sm font-black text-slate-800">Projektets grundsten</h3>
                  <p className="text-xs text-slate-500 mt-1">Giv din nye sag en overskuelig identitet og juster arbejdstimer pr. dag.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1 sm:col-span-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Projekt / Sagsnavn</label>
                  <div className="relative">
                    <input
                      type="text"
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 pl-9 text-xs font-bold text-slate-700 outline-none focus:border-slate-400"
                      value={projectName}
                      onChange={(e) => setProjectName(e.target.value)}
                      placeholder="F.eks. Renovering Hovedgade eller Ny Skole..."
                      required
                    />
                    <Building className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Adresse / Byggeplads</label>
                  <div className="relative">
                    <input
                      type="text"
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 pl-9 text-xs font-semibold text-slate-700 outline-none focus:border-slate-400"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="Vejnavn og nummer"
                    />
                    <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Bygherre / Kunde</label>
                  <div className="relative">
                    <input
                      type="text"
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 pl-9 text-xs font-semibold text-slate-700 outline-none focus:border-slate-400"
                      value={customer}
                      onChange={(e) => setCustomer(e.target.value)}
                      placeholder="F.eks. Aarhus Kommune..."
                    />
                    <Briefcase className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Tildelt Sagsleder</label>
                  <input
                    type="text"
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs font-semibold text-slate-700 outline-none focus:border-slate-400"
                    value={manager}
                    onChange={(e) => setManager(e.target.value)}
                    placeholder="Byggeleder eller formand"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span>Daglige arbejdstimer pr. mand</span>
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs font-bold text-slate-700 outline-none focus:border-slate-400"
                    value={workHoursPerDay}
                    onChange={(e) => setWorkHoursPerDay(Math.max(1, Math.min(24, parseFloat(e.target.value) || 7.4)))}
                    placeholder="f.eks. 7.4"
                    required
                  />
                  <span className="text-[9px] text-slate-400 font-medium">Standard overenskomst er 7,4 / 37 timers arbejdsuge.</span>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Tidsplan og Lukkedage */}
          {step === 2 && (
            <div className="flex flex-col gap-4 animate-fadeIn">
              <div className="flex gap-3 mb-2">
                <span className="text-2xl">📅</span>
                <div>
                  <h3 className="text-sm font-black text-slate-800">Projektets start & tidsrum</h3>
                  <p className="text-xs text-slate-500 mt-1">Vælg den officielle startdato og mærk eventuelle helligdage eller ferielukninger.</p>
                </div>
              </div>

              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Officiel Startdato</label>
                  <input
                    type="date"
                    className="w-full sm:w-1/2 bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs font-bold text-slate-700 outline-none focus:border-slate-400"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    required
                  />
                  <span className="text-[10px] text-slate-400 font-medium mt-1">Dine tildelte opgaver i Gantt-diagrammet vil automatisk blive kaskade-beregnet i forhold til denne dato.</span>
                </div>

                {/* Automation summer holiday block */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex items-start gap-3.5 mt-2">
                  <input
                    type="checkbox"
                    id="summer-hol-cb"
                    checked={includeSummerHoliday}
                    onChange={(e) => setIncludeSummerHoliday(e.target.checked)}
                    className="w-4 h-4 text-slate-700 h-4 w-4 accent-slate-800 shrink-0 mt-0.5 cursor-pointer"
                  />
                  <label htmlFor="summer-hol-cb" className="cursor-pointer select-none">
                    <span className="text-xs font-bold text-slate-800 block">Konfigurer industrisommerferien automatisk? (3 uger)</span>
                    <span className="text-[10px] text-slate-500 block mt-1 leading-normal">
                      Sætter uge 29, 30 og 31 (13. juli til og med 31. juli 2026) som uarbejdsdygtige lukkedage. Systemet beregner automatisk udenom disse, medmindre du eksplicit vælger weekendarbejde.
                    </span>
                  </label>
                </div>

                {/* Danish holidays automatic load option */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex items-start gap-3.5 mt-1">
                  <input
                    type="checkbox"
                    id="danish-hol-cb"
                    checked={includeDanishHolidays}
                    onChange={(e) => setIncludeDanishHolidays(e.target.checked)}
                    className="w-4 h-4 text-slate-700 h-4 w-4 accent-slate-800 shrink-0 mt-0.5 cursor-pointer"
                  />
                  <label htmlFor="danish-hol-cb" className="cursor-pointer select-none w-full">
                    <span className="text-xs font-bold text-slate-800 block flex items-center justify-between gap-2">
                      <span>Automatisk indlæsning af de danske helligdage (kalendarium.dk)</span>
                      <span className="text-[9px] bg-purple-100 text-purple-850 px-1.5 py-0.5 rounded-full font-black uppercase">Anbefalet</span>
                    </span>
                    <span className="text-[10px] text-slate-500 block mt-1 leading-normal">
                      Henter automatisk alle officielle danske helligdage som skærtorsdag, langfredag, påskedag, 2. påskedag, Kr. himmelfart, pinsedag, 2. pinsedag, grundlovsdag, jul m.fl. for dit projektår.
                    </span>
                  </label>
                </div>

                {/* Custom Holidays list configuration inline */}
                <div className="flex flex-col gap-2 mt-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Manuelt tilføj øvrige fridage / lukkedage (valgfrit)</label>
                  <div className="flex gap-2">
                    <input
                      type="date"
                      className="bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-semibold text-slate-700 outline-none focus:border-slate-400"
                      value={newHoliday}
                      onChange={(e) => setNewHoliday(e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={addCustomHoliday}
                      disabled={!newHoliday}
                      className="bg-slate-700 disabled:opacity-50 hover:bg-slate-800 text-white rounded-lg px-4 text-xs font-bold cursor-pointer h-9 shrink-0 flex items-center gap-1"
                    >
                      <span>Tilføj</span>
                    </button>
                  </div>

                  {customHolidays.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2 p-2 bg-slate-50 rounded-lg border border-slate-100">
                      {customHolidays.map(h => (
                        <span key={h} className="inline-flex items-center gap-1.5 bg-white border border-slate-200 text-[10px] font-bold text-slate-600 px-2 py-1 rounded-md">
                          <span>{new Date(`${h}T12:00:00`).toLocaleDateString("da-DK")}</span>
                          <button
                            type="button"
                            onClick={() => removeCustomHoliday(h)}
                            className="text-slate-400 hover:text-red-500 font-bold border-0 bg-transparent text-xs p-0 leading-none cursor-pointer"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: Etaper / Projektfaser */}
          {step === 3 && (
            <div className="flex flex-col gap-4 animate-fadeIn">
              <div className="flex gap-3 mb-2">
                <span className="text-2xl">🧱</span>
                <div>
                  <h3 className="text-sm font-black text-slate-800">Projektetaper</h3>
                  <p className="text-xs text-slate-500 mt-1">Dine overordnede milepæle danner rammerne og viser sig som smukke baggrundsbjælker på Gantt-kortet.</p>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <p className="text-xs text-slate-500 font-medium">Beregnet ud fra din valgte startdato ({startDate}), foreslår vi følgende 3 overordnede etaper. Fravælg dem, du ikke har brug for:</p>

                {/* Etape 1 Option */}
                <div className={`p-4 rounded-xl border transition ${includeEtaper.prep ? "bg-slate-50 border-slate-350" : "bg-white border-slate-200 opacity-60"}`}>
                  <div className="flex items-center justify-between mb-2">
                    <label className="flex items-center gap-2.5 font-bold text-xs text-slate-850 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={includeEtaper.prep}
                        onChange={(e) => setIncludeEtaper({ ...includeEtaper, prep: e.target.checked })}
                        className="w-4 h-4 accent-slate-800 cursor-pointer"
                      />
                      <span>Etape 1: Forberedelse & Udgravning</span>
                    </label>
                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: "#5c6e75" }} />
                  </div>
                  {includeEtaper.prep && (
                    <div className="grid grid-cols-2 gap-3 mt-3">
                      <div>
                        <label className="text-[9px] font-bold text-slate-400 uppercase">Startdato</label>
                        <input
                          type="date"
                          className="w-full bg-white border border-slate-200 rounded p-1 text-[11px] font-bold"
                          value={stageDates.prepStartDate}
                          onChange={(e) => setStageDates({ ...stageDates, prepStartDate: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="text-[9px] font-bold text-slate-400 uppercase">Slutdato</label>
                        <input
                          type="date"
                          className="w-full bg-white border border-slate-200 rounded p-1 text-[11px] font-bold"
                          value={stageDates.prepEndDate}
                          onChange={(e) => setStageDates({ ...stageDates, prepEndDate: e.target.value })}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Etape 2 Option */}
                <div className={`p-4 rounded-xl border transition ${includeEtaper.raw ? "bg-slate-50 border-slate-355" : "bg-white border-slate-200 opacity-60"}`}>
                  <div className="flex items-center justify-between mb-2">
                    <label className="flex items-center gap-2.5 font-bold text-xs text-slate-850 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={includeEtaper.raw}
                        onChange={(e) => setIncludeEtaper({ ...includeEtaper, raw: e.target.checked })}
                        className="w-4 h-4 accent-slate-800 cursor-pointer"
                      />
                      <span>Etape 2: Råhus & Indvendigt</span>
                    </label>
                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: "#d97706" }} />
                  </div>
                  {includeEtaper.raw && (
                    <div className="grid grid-cols-2 gap-3 mt-3">
                      <div>
                        <label className="text-[9px] font-bold text-slate-400 uppercase">Startdato</label>
                        <input
                          type="date"
                          className="w-full bg-white border border-slate-200 rounded p-1 text-[11px] font-bold"
                          value={stageDates.rawStartDate}
                          onChange={(e) => setStageDates({ ...stageDates, rawStartDate: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="text-[9px] font-bold text-slate-400 uppercase">Slutdato</label>
                        <input
                          type="date"
                          className="w-full bg-white border border-slate-200 rounded p-1 text-[11px] font-bold"
                          value={stageDates.rawEndDate}
                          onChange={(e) => setStageDates({ ...stageDates, rawEndDate: e.target.value })}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Etape 3 Option */}
                <div className={`p-4 rounded-xl border transition ${includeEtaper.finish ? "bg-slate-50 border-slate-355" : "bg-white border-slate-200 opacity-60"}`}>
                  <div className="flex items-center justify-between mb-2">
                    <label className="flex items-center gap-2.5 font-bold text-xs text-slate-850 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={includeEtaper.finish}
                        onChange={(e) => setIncludeEtaper({ ...includeEtaper, finish: e.target.checked })}
                        className="w-4 h-4 accent-slate-800 cursor-pointer"
                      />
                      <span>Etape 3: Forbrugere & Aflevering</span>
                    </label>
                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: "#0d9488" }} />
                  </div>
                  {includeEtaper.finish && (
                    <div className="grid grid-cols-2 gap-3 mt-3">
                      <div>
                        <label className="text-[9px] font-bold text-slate-400 uppercase">Startdato</label>
                        <input
                          type="date"
                          className="w-full bg-white border border-slate-200 rounded p-1 text-[11px] font-bold"
                          value={stageDates.finishStartDate}
                          onChange={(e) => setStageDates({ ...stageDates, finishStartDate: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="text-[9px] font-bold text-slate-400 uppercase">Slutdato</label>
                        <input
                          type="date"
                          className="w-full bg-white border border-slate-200 rounded p-1 text-[11px] font-bold"
                          value={stageDates.finishEndDate}
                          onChange={(e) => setStageDates({ ...stageDates, finishEndDate: e.target.value })}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: Standard Faggrupper / Resurser */}
          {step === 4 && (
            <div className="flex flex-col gap-4 animate-fadeIn">
              <div className="flex gap-3 mb-2">
                <span className="text-2xl">👷</span>
                <div>
                  <h3 className="text-sm font-black text-slate-800">Standard faggrupper / svende</h3>
                  <p className="text-xs text-slate-500 mt-1">Vælg, hvilke resurser I har til rådighed på denne sag til at starte med.</p>
                </div>
              </div>

              <div className="flex flex-col gap-2 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <p className="text-[11px] text-slate-500 font-bold mb-2">Forudbyg dit sjak (I kan redigere timetakster og weekendregler løbende under Resurser):</p>
                
                {/* Trade 1: Carpenter */}
                <label className="flex items-center justify-between p-2.5 bg-white rounded-lg border border-slate-200 cursor-pointer hover:bg-slate-50/50 select-none">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selectedTrades.carpenter}
                      onChange={(e) => setSelectedTrades({ ...selectedTrades, carpenter: e.target.checked })}
                      className="w-4 h-4 accent-slate-800"
                    />
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: "#8b5cf6" }} />
                    <span className="text-xs font-bold text-slate-700">Tømrer (Svend)</span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono font-bold">Takst: 320 kr/t</span>
                </label>

                {/* Trade 2: Electrician */}
                <label className="flex items-center justify-between p-2.5 bg-white rounded-lg border border-slate-200 cursor-pointer hover:bg-slate-50/50 select-none">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selectedTrades.electrician}
                      onChange={(e) => setSelectedTrades({ ...selectedTrades, electrician: e.target.checked })}
                      className="w-4 h-4 accent-slate-800"
                    />
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: "#3b82f6" }} />
                    <span className="text-xs font-bold text-slate-700">Elektriker (Mester)</span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono font-bold">Takst: 345 kr/t</span>
                </label>

                {/* Trade 3: Plumber */}
                <label className="flex items-center justify-between p-2.5 bg-white rounded-lg border border-slate-200 cursor-pointer hover:bg-slate-50/50 select-none">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selectedTrades.plumber}
                      onChange={(e) => setSelectedTrades({ ...selectedTrades, plumber: e.target.checked })}
                      className="w-4 h-4 accent-slate-800"
                    />
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: "#10b981" }} />
                    <span className="text-xs font-bold text-slate-700">VVS-installatør</span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono font-bold">Takst: 360 kr/t</span>
                </label>

                {/* Trade 4: Ground Concrete */}
                <label className="flex items-center justify-between p-2.5 bg-white rounded-lg border border-slate-200 cursor-pointer hover:bg-slate-50/50 select-none">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selectedTrades.groundConcrete}
                      onChange={(e) => setSelectedTrades({ ...selectedTrades, groundConcrete: e.target.checked })}
                      className="w-4 h-4 accent-slate-800"
                    />
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: "#ec4899" }} />
                    <span className="text-xs font-bold text-slate-700">Jord & Beton</span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono font-bold">Takst: 380 kr/t</span>
                </label>

                {/* Trade 5: Machine Rent */}
                <label className="flex items-center justify-between p-2.5 bg-white rounded-lg border border-slate-200 cursor-pointer hover:bg-slate-50/50 select-none">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selectedTrades.machineRent}
                      onChange={(e) => setSelectedTrades({ ...selectedTrades, machineRent: e.target.checked })}
                      className="w-4 h-4 accent-slate-800"
                    />
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: "#f97316" }} />
                    <span className="text-xs font-bold text-slate-700">Leje af Gravemaskine (Fast pris)</span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono font-bold">Sats: 4500 kr. pr opg.</span>
                </label>
              </div>
            </div>
          )}

          {/* STEP 5: Velkommen og Start */}
          {step === 5 && (
            <div className="flex flex-col gap-4 text-center items-center py-4 animate-fadeIn">
              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center text-3xl mb-2 animate-bounce">
                🚀
              </div>
              <h3 className="text-base font-black text-slate-800">Dit byggeprojekt er klar!</h3>
              <p className="text-xs text-slate-500 max-w-md leading-relaxed mt-1">
                Du har nu lagt fundamentet for din planlægning. Programmet er tomt og parat til dine konkrete håndværksmæssige opgaver!
              </p>

              <div className="bg-slate-50 rounded-xl p-4 text-left border border-slate-250 text-xs text-slate-650 max-w-md mt-2 flex flex-col gap-2.5">
                <span className="font-extrabold text-slate-800 block">💡 3 Hurtige tips til din planlægning:</span>
                <p>
                  1. **Opret dine opgaver** udefra varighed og knyt dem til et sjak (faggruppe) for at automatisk udregne arbejdstidslønninger.
                </p>
                <p>
                  2. **Brug afhængigheder** (forgængere) til at skabe en uafbrudt kaskade. Systemet finder automatisk den **Kritiske arbejdsvej** markeret med ild-ikonet (🔥).
                </p>
                <p>
                  3. **Overhold dine faste etaper**. Hvis din planlagte helhed går over dine etapedatoer, advares du med det samme!
                </p>
              </div>
            </div>
          )}

        </div>

        {/* Wizard Footer bar */}
        <div className="bg-slate-50 px-6 py-4 flex justify-between items-center border-t border-slate-100">
          <button
            type="button"
            onClick={handleBack}
            className={`px-4 py-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer ${
              step === 1 ? "invisible" : ""
            }`}
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Tilbage</span>
          </button>

          <button
            type="button"
            onClick={handleNext}
            className="px-5 py-2.5 bg-slate-800 hover:bg-slate-900 active:scale-95 text-white transition rounded-lg text-xs font-extrabold flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <span>{step === totalSteps ? "Afslut & Start" : "Næste trin"}</span>
            {step === totalSteps ? <Check className="w-3.5 h-3.5" /> : <ArrowRight className="w-3.5 h-3.5" />}
          </button>
        </div>

      </div>
    </div>
  );
}
