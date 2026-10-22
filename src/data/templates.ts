import type { AppData, Dependency, Stage, Task, Trade } from "../types.ts";
import { calculateSchedule } from "../utils/scheduler.ts";
import { danishHolidays } from "../utils/holidays.ts";
import { withLinks } from "../utils/links.ts";

export interface TemplateInfo {
  id: string;
  name: string;
  description: string;
}

type TradeKey = "ground" | "concrete" | "carpenter" | "roofer" | "plumber" | "electrician" | "painter" | "floor";

const TRADES: Record<TradeKey, { name: string; rate: number; color: string }> = {
  ground: { name: "Entreprenør (jord)", rate: 520, color: "#92400e" },
  concrete: { name: "Beton & murer", rate: 480, color: "#64748b" },
  carpenter: { name: "Tømrer", rate: 470, color: "#d97706" },
  roofer: { name: "Tagdækker", rate: 490, color: "#7c3aed" },
  plumber: { name: "VVS", rate: 520, color: "#0284c7" },
  electrician: { name: "El-installatør", rate: 520, color: "#ca8a04" },
  painter: { name: "Maler", rate: 430, color: "#db2777" },
  floor: { name: "Gulv & fliser", rate: 450, color: "#16a34a" },
};

const STAGE_COLORS = ["#5c6e75", "#b45309", "#0369a1", "#15803d"];

/** `after`: a key (finish-to-start) or [key, "FS" | "SS", lag]. */
type After = string | [string, "FS" | "SS", number];

interface TaskDef {
  key: string;
  title: string;
  days: number;
  trades: TradeKey[];
  stage: number;
  after?: After[];
  milestone?: boolean;
  desc?: string;
}

interface TemplateDef extends TemplateInfo {
  projectName: string;
  stages: string[];
  tasks: TaskDef[];
}

const TEMPLATES: TemplateDef[] = [
  {
    id: "parcelhus",
    name: "Nyt parcelhus",
    description: "Nybyg fra afsætning til aflevering, 20 opgaver i 4 etaper.",
    projectName: "Nyt parcelhus",
    stages: ["Etape 1: Grund & fundament", "Etape 2: Råhus", "Etape 3: Lukning & installation", "Etape 4: Færdiggørelse"],
    tasks: [
      { key: "afs", title: "Afsætning og afrømning", days: 2, trades: ["ground"], stage: 0 },
      { key: "udg", title: "Udgravning", days: 4, trades: ["ground"], stage: 0, after: ["afs"] },
      { key: "fund", title: "Fundament og kloak", days: 6, trades: ["concrete", "plumber"], stage: 0, after: ["udg"] },
      { key: "dæk", title: "Terrændæk og sokkel", days: 5, trades: ["concrete"], stage: 0, after: ["fund"] },
      { key: "m1", title: "Fundament godkendt", days: 0, trades: [], stage: 0, after: ["dæk"], milestone: true },
      { key: "mur", title: "Opmuring af ydervægge", days: 10, trades: ["concrete"], stage: 1, after: ["m1"] },
      { key: "spær", title: "Tagkonstruktion (spær)", days: 6, trades: ["carpenter"], stage: 1, after: ["mur"] },
      { key: "m2", title: "Rejsegilde", days: 0, trades: [], stage: 1, after: ["spær"], milestone: true },
      { key: "tag", title: "Tagdækning", days: 6, trades: ["roofer"], stage: 1, after: ["spær"] },
      { key: "vin", title: "Vinduer og yderdøre", days: 4, trades: ["carpenter"], stage: 2, after: ["tag"] },
      { key: "el1", title: "El - førstegangsinstallation", days: 5, trades: ["electrician"], stage: 2, after: ["vin"] },
      { key: "vvs1", title: "VVS - førstegangsinstallation", days: 5, trades: ["plumber"], stage: 2, after: [["el1", "SS", 0]] },
      { key: "iso", title: "Isolering og dampspærre", days: 4, trades: ["carpenter"], stage: 2, after: ["el1", "vvs1"] },
      { key: "gips", title: "Gipsplader og lofter", days: 6, trades: ["carpenter"], stage: 2, after: ["iso"] },
      { key: "mal", title: "Spartling og maling", days: 8, trades: ["painter"], stage: 3, after: ["gips"] },
      { key: "gulv", title: "Gulve og fliser", days: 7, trades: ["floor"], stage: 3, after: [["mal", "FS", 0]] },
      { key: "køk", title: "Køkken og indvendige døre", days: 4, trades: ["carpenter"], stage: 3, after: ["gulv"] },
      { key: "fær", title: "El og VVS færdiggørelse", days: 4, trades: ["electrician", "plumber"], stage: 3, after: ["køk"] },
      { key: "bel", title: "Terræn og belægning", days: 5, trades: ["ground"], stage: 3, after: [["tag", "FS", 10]] },
      { key: "m3", title: "Slutsyn og aflevering", days: 0, trades: [], stage: 3, after: ["fær", "bel"], milestone: true },
    ],
  },
  {
    id: "renovering",
    name: "Renovering af badeværelse",
    description: "Nedrivning til aflevering, 11 opgaver med tørretid, 4 etaper.",
    projectName: "Renovering af badeværelse",
    stages: ["Etape 1: Nedrivning", "Etape 2: Installation", "Etape 3: Overflader", "Etape 4: Aflevering"],
    tasks: [
      { key: "ned", title: "Afdækning og nedrivning", days: 2, trades: ["carpenter"], stage: 0 },
      { key: "bort", title: "Bortskaffelse af affald", days: 1, trades: ["carpenter"], stage: 0, after: ["ned"] },
      { key: "vvs", title: "VVS - råinstallation", days: 3, trades: ["plumber"], stage: 1, after: ["bort"] },
      { key: "el", title: "El - råinstallation", days: 2, trades: ["electrician"], stage: 1, after: [["vvs", "SS", 0]] },
      { key: "mem", title: "Vandtæt membran og afretning", days: 3, trades: ["concrete"], stage: 1, after: ["vvs", "el"], desc: "Tørretid på 3 dage indregnes før fliser." },
      { key: "fli", title: "Fliser på vægge og gulv", days: 5, trades: ["floor"], stage: 2, after: [["mem", "FS", 3]] },
      { key: "mal", title: "Maling af loft og vægge", days: 3, trades: ["painter"], stage: 2, after: ["fli"] },
      { key: "mon", title: "Montering af toilet, vask og bruser", days: 2, trades: ["plumber"], stage: 3, after: ["fli"] },
      { key: "elf", title: "El - færdigmontering", days: 1, trades: ["electrician"], stage: 3, after: ["mal"] },
      { key: "ren", title: "Rengøring", days: 1, trades: ["painter"], stage: 3, after: ["mon", "elf"] },
      { key: "afl", title: "Aflevering", days: 0, trades: [], stage: 3, after: ["ren"], milestone: true },
    ],
  },
  {
    id: "tilbygning",
    name: "Tilbygning til eksisterende hus",
    description: "Udgravning til aflevering, 16 opgaver i 4 etaper.",
    projectName: "Tilbygning",
    stages: ["Etape 1: Grund", "Etape 2: Råhus", "Etape 3: Lukning & installation", "Etape 4: Færdiggørelse"],
    tasks: [
      { key: "plads", title: "Byggepladsindretning og afsætning", days: 2, trades: ["ground"], stage: 0 },
      { key: "udg", title: "Udgravning", days: 3, trades: ["ground"], stage: 0, after: ["plads"] },
      { key: "fund", title: "Fundament", days: 5, trades: ["concrete"], stage: 0, after: ["udg"] },
      { key: "dæk", title: "Terrændæk", days: 3, trades: ["concrete"], stage: 0, after: ["fund"] },
      { key: "væg", title: "Bindingsværk og ydervægge", days: 8, trades: ["carpenter"], stage: 1, after: ["dæk"] },
      { key: "spær", title: "Tagkonstruktion", days: 5, trades: ["carpenter"], stage: 1, after: ["væg"] },
      { key: "tag", title: "Tagdækning", days: 4, trades: ["roofer"], stage: 1, after: ["spær"] },
      { key: "vin", title: "Vinduer og døre", days: 3, trades: ["carpenter"], stage: 2, after: ["spær"] },
      { key: "gen", title: "Gennembrydning til eksisterende hus", days: 2, trades: ["concrete"], stage: 2, after: ["vin", "tag"] },
      { key: "el", title: "El - installation", days: 5, trades: ["electrician"], stage: 2, after: ["vin"] },
      { key: "vvs", title: "VVS - installation", days: 4, trades: ["plumber"], stage: 2, after: [["el", "SS", 1]] },
      { key: "iso", title: "Isolering og gipsplader", days: 8, trades: ["carpenter"], stage: 2, after: ["el", "vvs", "gen"] },
      { key: "mal", title: "Maling", days: 5, trades: ["painter"], stage: 3, after: ["iso"] },
      { key: "gulv", title: "Gulv", days: 4, trades: ["floor"], stage: 3, after: ["mal"] },
      { key: "fær", title: "El og VVS færdiggørelse", days: 3, trades: ["electrician", "plumber"], stage: 3, after: ["gulv"] },
      { key: "afl", title: "Aflevering", days: 0, trades: [], stage: 3, after: ["fær"], milestone: true },
    ],
  },
];

export const TEMPLATE_LIST: TemplateInfo[] = TEMPLATES.map(({ id, name, description }) => ({ id, name, description }));

/** A ready-made project that starts on `startDate`. Stage dates are derived from the calculated plan. */
export function buildTemplate(id: string, startDate: string): AppData | null {
  const def = TEMPLATES.find((t) => t.id === id);
  if (!def) return null;

  const trades: Trade[] = (Object.keys(TRADES) as TradeKey[]).map((key) => ({
    id: `tr-${key}`,
    name: TRADES[key].name,
    rate: TRADES[key].rate,
    isFixedPrice: false,
    weekendSupplement: 50,
    holidaySupplement: 100,
    color: TRADES[key].color,
  }));
  const usedTrades = new Set(def.tasks.flatMap((t) => t.trades));
  const projectTrades = trades.filter((tr) => usedTrades.has(tr.id.slice(3) as TradeKey));

  const idOf = new Map(def.tasks.map((t, i) => [t.key, `task-${id}-${i + 1}`]));
  const stages: Stage[] = def.stages.map((name, i) => ({ id: `stage-${id}-${i + 1}`, name, color: STAGE_COLORS[i % STAGE_COLORS.length], startDate, endDate: startDate }));

  const tasks: Task[] = def.tasks.map((d) => {
    const links: Dependency[] = (d.after || []).map((a) => {
      const [key, type, lag] = typeof a === "string" ? [a, "FS" as const, 0] : a;
      return { taskId: idOf.get(key)!, type, lag };
    });
    return withLinks(
      {
        id: idOf.get(d.key)!,
        title: d.title,
        desc: d.desc || "",
        duration: d.days,
        manualStart: null,
        tradeIds: d.trades.map((k) => `tr-${k}`),
        dependencyId: null,
        allowWeekend: false,
        allowHoliday: false,
        stageId: stages[d.stage].id,
        isMilestone: !!d.milestone,
        progress: 0,
      },
      links
    );
  });

  const year = Number(startDate.slice(0, 4));
  const holidays = [year, year + 1, year + 2]
    .flatMap((y) => danishHolidays(y))
    .map((h) => ({ id: `hol-auto-${h.date}`, date: h.date, name: h.name }));
  const settings = { workHoursPerDay: 7.4 };

  // Stage dates follow the calculated plan so the template starts without warnings
  const plan = calculateSchedule(tasks, projectTrades, holidays, settings, startDate, [], []);
  for (const stage of stages) {
    const inStage = plan.tasks.filter((t) => t.stageId === stage.id && t.calcStart && t.calcEnd);
    if (inStage.length > 0) {
      stage.startDate = inStage.reduce((m, t) => (t.calcStart! < m ? t.calcStart! : m), inStage[0].calcStart!);
      stage.endDate = inStage.reduce((m, t) => (t.calcEnd! > m ? t.calcEnd! : m), inStage[0].calcEnd!);
    }
  }

  return {
    startDate,
    settings,
    projectInfo: { projectName: def.projectName, address: "", customer: "", manager: "" },
    holidays,
    trades: projectTrades,
    tasks,
    stages,
    weatherDelays: [],
    baseline: null,
    scheduleError: null,
    startDateWarning: null,
  };
}
