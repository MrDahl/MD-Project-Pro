import React, { useState } from "react";
import { Settings, ProjectInfo, Stage, WeatherDelay, Holiday } from "../types";
import { Calendar, Clock, Plus, Trash2, CalendarX, Info, FileText, MapPin, User, Building, Palmtree, Layers, CloudSnow } from "lucide-react";

interface ProjectSettingsProps {
  startDate: string;
  settings: Settings;
  projectInfo?: ProjectInfo;
  holidays: Holiday[];
  stages?: Stage[];
  weatherDelays?: WeatherDelay[];
  onUpdateStartDate: (date: string) => void;
  onUpdateWorkHours: (hours: number) => void;
  onUpdateProjectInfo: (info: ProjectInfo) => void;
  onAddHoliday: (date: string, name: string) => void;
  onDeleteHoliday: (idx: number) => void;
  onAddStage: (stage: Stage) => void;
  onDeleteStage: (id: string) => void;
  onAddWeatherDelay: (label: string, start: string, end: string) => void;
  onDeleteWeatherDelay: (id: string) => void;
}

const PRESET_COLORS = [
  { hex: "#4f46e5", label: "Indigo" },
  { hex: "#10b981", label: "Grøn" },
  { hex: "#f59e0b", label: "Gul" },
  { hex: "#ef4444", label: "Rød" },
  { hex: "#8b5cf6", label: "Lilla" },
  { hex: "#06b6d4", label: "Lyseblå" },
  { hex: "#ec4899", label: "Pink" },
];

export function ProjectSettings({
  startDate,
  settings,
  projectInfo = { projectName: "MD Project Plan", address: "", customer: "", manager: "" },
  holidays,
  stages = [],
  weatherDelays = [],
  onUpdateStartDate,
  onUpdateWorkHours,
  onUpdateProjectInfo,
  onAddHoliday,
  onDeleteHoliday,
  onAddStage,
  onDeleteStage,
  onAddWeatherDelay,
  onDeleteWeatherDelay,
}: ProjectSettingsProps) {
  const [newHoliday, setNewHoliday] = useState("");
  const [newHolidayName, setNewHolidayName] = useState("");

  const [stageName, setStageName] = useState("");
  const [stageColor, setStageColor] = useState("#4f46e5");
  const [stageStart, setStageStart] = useState("");
  const [stageEnd, setStageEnd] = useState("");

  const [weatherLabel, setWeatherLabel] = useState("");
  const [weatherStart, setWeatherStart] = useState("");
  const [weatherEnd, setWeatherEnd] = useState("");

  const handleInfoChange = (field: keyof ProjectInfo, val: string) => {
    onUpdateProjectInfo({
      ...projectInfo,
      [field]: val,
    });
  };

  const handleAddHoliday = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHoliday) return;
    onAddHoliday(newHoliday, newHolidayName.trim() || "Ferie / Helligdag");
    setNewHoliday("");
    setNewHolidayName("");
  };

  const handleCreateStage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!stageName.trim() || !stageStart || !stageEnd) return;
    onAddStage({
      id: "stage-" + Date.now(),
      name: stageName,
      color: stageColor,
      startDate: stageStart,
      endDate: stageEnd,
    });
    setStageName("");
    setStageStart("");
    setStageEnd("");
  };

  const formatDateLabel = (dStr: string) => {
    try {
      const d = new Date(`${dStr}T12:00:00`);
      return d.toLocaleDateString("da-DK", { day: "numeric", month: "long", year: "numeric" });
    } catch {
      return dStr;
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 select-none">
      {/* 1. Project Information Card */}
      <div className="bg-white border border-slate-100 rounded-xl p-5 shadow-xs flex flex-col gap-4">
        <h3 className="text-base font-bold text-slate-800 border-b border-slate-100 pb-2 flex items-center gap-1.5">
          <FileText className="w-5 h-5 text-slate-700" />
          <span>Projektinformation</span>
        </h3>

        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Projektets navn</label>
          <input
            type="text"
            value={projectInfo.projectName || ""}
            onChange={(e) => handleInfoChange("projectName", e.target.value)}
            placeholder="f.eks. Renovering Hansen"
            className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs font-bold text-slate-700 outline-none focus:border-slate-500"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
            <MapPin className="w-3.5 h-3.5 text-slate-450" />
            <span>Adresse</span>
          </label>
          <input
            type="text"
            value={projectInfo.address || ""}
            onChange={(e) => handleInfoChange("address", e.target.value)}
            placeholder="f.eks. Nørregade 42, Aarhus"
            className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs font-bold text-slate-700 outline-none focus:border-slate-500"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
            <Building className="w-3.5 h-3.5 text-slate-450" />
            <span>Kunde</span>
          </label>
          <input
            type="text"
            value={projectInfo.customer || ""}
            onChange={(e) => handleInfoChange("customer", e.target.value)}
            placeholder="f.eks. M. Hansen Holding"
            className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs font-bold text-slate-700 outline-none focus:border-slate-500"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
            <User className="w-3.5 h-3.5 text-slate-450" />
            <span>Projektansvarlig</span>
          </label>
          <input
            type="text"
            value={projectInfo.manager || ""}
            onChange={(e) => handleInfoChange("manager", e.target.value)}
            placeholder="f.eks. Byggeleder Olsen"
            className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs font-bold text-slate-700 outline-none focus:border-slate-500"
          />
        </div>
      </div>

      {/* 2. Settings configuration Card */}
      <div className="bg-white border border-slate-100 rounded-xl p-5 shadow-xs flex flex-col gap-4">
        <h3 className="text-base font-bold text-slate-800 border-b border-slate-100 pb-2 flex items-center gap-1.5">
          <Calendar className="w-5 h-5 text-slate-700" />
          <span>Projektindstillinger</span>
        </h3>

        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Projektets startdato</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => onUpdateStartDate(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs font-bold text-slate-700 outline-none focus:border-slate-500"
          />
          <span className="text-[10px] text-slate-400 font-medium">
            Tidsplanen vil automatisk kaskadeskubbe til højre med start herfra.
          </span>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span>Standard arbejdstimer pr. dag</span>
          </label>
          <input
            type="number"
            value={settings.workHoursPerDay}
            onChange={(e) => onUpdateWorkHours(Math.max(1, parseFloat(e.target.value) || 7.4))}
            className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs font-bold text-slate-700 outline-none focus:border-slate-500"
            step="0.1"
            min={1}
            max={24}
            required
          />
          <span className="text-[10px] text-slate-400 font-medium">
            Bruges til at udregne dagsprisen for faggrupper (Standard er en 7.4 timers overenskomst).
          </span>
        </div>

        <div className="bg-amber-50 rounded-lg p-3 border border-amber-100/50 flex gap-2 text-[10px] font-medium text-amber-900 mt-2">
          <Info className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            Bemærk! Hvis du ændrer arbejdstimerne, genberegnes alle timebaserede lønudgifter i faggrupperne øjeblikkeligt i budgettet.
          </p>
        </div>
      </div>

      {/* 3. Custom Holidays list Card */}
      <div className="bg-white border border-slate-100 rounded-xl p-5 shadow-xs flex flex-col gap-4">
        <h3 className="text-base font-bold text-slate-800 border-b border-slate-100 pb-2 flex items-center gap-1.5">
          <CalendarX className="w-5 h-5 text-slate-750" />
          <span>Kalender & Helligdage / Fridage</span>
        </h3>

        {/* Add holiday form */}
        <form onSubmit={handleAddHoliday} className="flex flex-col gap-2">
          <div className="flex gap-2">
            <input
              type="date"
              value={newHoliday}
              onChange={(e) => setNewHoliday(e.target.value)}
              className="flex-1 bg-slate-50 border border-slate-200 p-2 text-xs font-semibold text-slate-700 outline-none focus:border-slate-500 rounded-lg"
            />
            <input
              type="text"
              value={newHolidayName}
              onChange={(e) => setNewHolidayName(e.target.value)}
              placeholder="F.eks. Sommerferie, Grundlovsdag"
              className="flex-1 bg-slate-50 border border-slate-200 p-2 text-xs font-semibold text-slate-700 outline-none focus:border-slate-500 rounded-lg"
            />
          </div>
          <button
            type="submit"
            disabled={!newHoliday}
            className="w-full bg-slate-700 active:bg-slate-800 text-white hover:bg-slate-800 p-2.5 rounded-lg text-xs font-extrabold cursor-pointer disabled:opacity-50 shrink-0 flex items-center justify-center gap-1.5 shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Tilføj navngivet fridag / helligdag</span>
          </button>
        </form>

        {/* Holidays scrolling list */}
        <div className="flex flex-col gap-2">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
            Registrerede lukkedage ({holidays.length}):
          </span>

          {holidays.length === 0 ? (
            <div className="text-center py-10 border border-dashed border-slate-200 rounded-lg text-[11px] text-slate-400">
              Der er endnu ikke angivet nogen helligdage eller lukkedage i systemet.
            </div>
          ) : (
            <div className="flex flex-col gap-1.5 max-h-[160px] overflow-y-auto pr-1">
              {[...holidays].sort((a, b) => a.date.localeCompare(b.date)).map((h, i) => (
                <div
                  key={h.id || h.date + i}
                  className="bg-slate-50 border border-slate-100 p-2.5 rounded-lg flex justify-between items-center text-xs text-slate-650 font-medium"
                >
                  <div className="flex flex-col gap-0.5">
                    <span className="font-extrabold text-slate-800">{h.name}</span>
                    <span className="text-[10px] text-slate-400 font-mono mt-0.5">
                      {formatDateLabel(h.date)}
                    </span>
                  </div>
                  <button
                    onClick={() => onDeleteHoliday(holidays.indexOf(h))}
                    type="button"
                    className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 active:scale-95 transition cursor-pointer rounded-lg border-0"
                    title="Slet lukkedag"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 4. Stages / Etaper Card */}
      <div className="bg-white border border-slate-100 rounded-xl p-5 shadow-xs flex flex-col gap-4 md:col-span-2">
        <h3 className="text-base font-bold text-slate-800 border-b border-slate-100 pb-2 flex items-center gap-1.5">
          <Layers className="w-5 h-5 text-slate-700" />
          <span>Etaper & Projektfaser</span>
        </h3>
        
        <p className="text-[11px] text-slate-500 leading-relaxed -mt-1">
          Etaper danner projektets overordnede tidsmæssige grundpiller på Gantt-målestokken og er uafhængige af opgavernes automatiske forskydninger.
        </p>

        <form onSubmit={handleCreateStage} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
          <div className="flex flex-col gap-1 sm:col-span-2">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Etapens Navn</label>
            <input
              type="text"
              value={stageName}
              onChange={(e) => setStageName(e.target.value)}
              placeholder="F.eks. Etape 1: Fundament"
              className="bg-white border border-slate-200 rounded-lg p-2 text-xs font-semibold text-slate-700 outline-none focus:border-slate-500"
              required
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Startdato</label>
            <input
              type="date"
              value={stageStart}
              onChange={(e) => setStageStart(e.target.value)}
              className="bg-white border border-slate-200 rounded-lg p-1.5 text-xs font-semibold text-slate-700 outline-none focus:border-slate-500"
              required
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Slutdato</label>
            <input
              type="date"
              value={stageEnd}
              onChange={(e) => setStageEnd(e.target.value)}
              className="bg-white border border-slate-200 rounded-lg p-1.5 text-xs font-semibold text-slate-700 outline-none focus:border-slate-500"
              required
            />
          </div>

          <div className="flex flex-col gap-1 sm:col-span-3">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Vælg Farvekode</label>
            <div className="flex items-center gap-1.5 flex-wrap mt-1">
              {PRESET_COLORS.map((col) => (
                <button
                  key={col.hex}
                  type="button"
                  onClick={() => setStageColor(col.hex)}
                  className={`px-2.5 py-1.5 rounded-lg border text-[10px] font-extrabold flex items-center gap-1 cursor-pointer transition ${
                    stageColor === col.hex
                      ? "border-slate-800 bg-slate-900 text-white"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-55"
                  }`}
                >
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: col.hex }} />
                  <span>{col.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-end justify-end">
            <button
              type="submit"
              className="w-full bg-slate-700 hover:bg-slate-800 text-white font-extrabold py-2 px-4 rounded-lg text-xs cursor-pointer flex items-center justify-center gap-1.5 shadow-xs h-9"
            >
              <Plus className="w-4 h-4" />
              <span>Opret etape</span>
            </button>
          </div>
        </form>

        <div className="flex flex-col gap-2">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
            Oprettede Projektetaper / Faser ({stages.length}):
          </span>

          {stages.length === 0 ? (
            <div className="text-center py-8 border border-dashed border-slate-200 rounded-lg text-[11px] text-slate-400">
              Der er endnu ikke oprettet nogen etaper. Brug formularen ovenfor til at tilføje jeres projektfaser med faste tidsintervaller.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {stages.map((stg) => (
                <div
                  key={stg.id}
                  className="bg-slate-50 border border-slate-200/60 rounded-xl p-3 flex justify-between items-center text-xs transition hover:shadow-2xs"
                >
                  <div className="flex items-start gap-2.5 min-w-0">
                    <span className="w-3 h-3 rounded-full shrink-0 mt-1" style={{ backgroundColor: stg.color }} />
                    <div className="min-w-0">
                      <h4 className="font-bold text-slate-800 leading-tight truncate">{stg.name}</h4>
                      <p className="text-[10px] text-slate-500 mt-1 font-semibold flex items-center gap-1 font-mono">
                        <span>{formatDateLabel(stg.startDate)}</span>
                        <span>-</span>
                        <span>{formatDateLabel(stg.endDate)}</span>
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => onDeleteStage(stg.id)}
                    className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg border-0 cursor-pointer transition active:scale-95"
                    title="Slet etape"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 5. Weather Delays Card */}
      <div className="bg-white border border-slate-100 rounded-xl p-5 shadow-xs flex flex-col gap-4 md:col-span-2">
        <h3 className="text-base font-bold text-slate-800 border-b border-slate-100 pb-2 flex items-center gap-1.5">
          <CloudSnow className="w-5 h-5 text-sky-600 animate-pulse" />
          <span>Vejrlig & Force Majeure (Vejrspildsdage)</span>
        </h3>

        <p className="text-[11px] text-slate-500 leading-relaxed -mt-1">
          Brug denne formular til at tildele vejrspildsdage eller andre uforudsete force majeure-betingelser (f.eks. dyb frost, skybrud, stormvejr). 
          Tidsplanen vil automatisk forskyde berørte udendørs- eller generiske arbejdsopgaver omkring disse datoer, og markere dem i Gantt-diagrammet.
        </p>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!weatherLabel.trim() || !weatherStart || !weatherEnd) return;
            onAddWeatherDelay(weatherLabel, weatherStart, weatherEnd);
            setWeatherLabel("");
            setWeatherStart("");
            setWeatherEnd("");
          }}
          className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200"
        >
          <div className="flex flex-col gap-1 sm:col-span-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Vejrsituation/Årsag</label>
            <input
              type="text"
              value={weatherLabel}
              onChange={(e) => setWeatherLabel(e.target.value)}
              placeholder="F.eks. Frostperiode, Skybrud"
              className="bg-white border border-slate-200 rounded-lg p-2 text-xs font-semibold text-slate-700 outline-none focus:border-slate-500"
              required
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Startdato</label>
            <input
              type="date"
              value={weatherStart}
              onChange={(e) => setWeatherStart(e.target.value)}
              className="bg-white border border-slate-200 rounded-lg p-1.5 text-xs font-semibold text-slate-700 outline-none focus:border-slate-500"
              required
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Slutdato</label>
            <input
              type="date"
              value={weatherEnd}
              onChange={(e) => setWeatherEnd(e.target.value)}
              className="bg-white border border-slate-200 rounded-lg p-1.5 text-xs font-semibold text-slate-700 outline-none focus:border-slate-500"
              required
            />
          </div>

          <div className="sm:col-span-3 flex justify-end mt-1">
            <button
              type="submit"
              disabled={!weatherLabel || !weatherStart || !weatherEnd}
              className="bg-sky-600 active:bg-sky-700 hover:bg-sky-700 text-white font-extrabold py-2 px-4 rounded-lg text-xs cursor-pointer flex items-center justify-center gap-1.5 shadow-xs h-9 disabled:opacity-50"
            >
              <Plus className="w-4 h-4" />
              <span>Registrér vejrspild</span>
            </button>
          </div>
        </form>

        <div className="flex flex-col gap-2">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
            Registrerede vejrspildsdage ({weatherDelays.length}):
          </span>

          {weatherDelays.length === 0 ? (
            <div className="text-center py-8 border border-dashed border-slate-200 rounded-lg text-[11px] text-slate-400">
              Der er pt. ikke registreret nogen manuelle vejrspildsdage i tidsplanen.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {weatherDelays.map((wd) => (
                <div
                  key={wd.id}
                  className="bg-sky-50/50 border border-sky-100 rounded-xl p-3 flex justify-between items-center text-xs transition hover:shadow-2xs"
                >
                  <div className="flex items-start gap-2.5 min-w-0">
                    <span className="text-lg shrink-0 mt-0.5 select-none">❄️</span>
                    <div className="min-w-0">
                      <h4 className="font-bold text-sky-950 leading-tight truncate">{wd.label}</h4>
                      <p className="text-[10px] text-sky-750 mt-1 font-semibold flex items-center gap-1 font-mono">
                        <span>{formatDateLabel(wd.startDate)}</span>
                        <span>-</span>
                        <span>{formatDateLabel(wd.endDate)}</span>
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => onDeleteWeatherDelay(wd.id)}
                    className="p-1.5 text-sky-450 hover:text-red-550 hover:bg-red-50 rounded-lg border-0 cursor-pointer transition active:scale-95"
                    title="Fjern vejrspildperiode"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
