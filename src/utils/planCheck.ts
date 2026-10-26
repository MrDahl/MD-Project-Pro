import type { Stage, Task, Trade } from "../types.ts";
import { taskLinks } from "./links.ts";
import type { PlanWarning } from "./warnings.ts";

export type CheckLevel = "ok" | "warn" | "info";

export interface CheckItem {
  id: string;
  level: CheckLevel;
  title: string;
  /** Short, friendly explanation of the result and what to do */
  detail: string;
  /** Task to open when the user wants to see an example */
  taskId?: string;
}

export interface PlanCheckResult {
  items: CheckItem[];
  passed: number;
  total: number;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Friendly checklist for a student's plan. `tasks` must be calculated; warnings come from findWarnings. */
export function checkPlan(tasks: Task[], trades: Trade[], stages: Stage[], warnings: PlanWarning[]): PlanCheckResult {
  const items: CheckItem[] = [];
  const real = tasks.filter((t) => !t.isRecurring);
  const work = real.filter((t) => !t.isMilestone);

  if (tasks.length === 0) {
    items.push({ id: "empty", level: "warn", title: "Planen har opgaver", detail: "Der er ingen opgaver endnu. Start med en skabelon eller brug hurtig-tilføj-linjen." });
    return { items, passed: 0, total: 1 };
  }
  items.push({ id: "empty", level: "ok", title: "Planen har opgaver", detail: `Du har ${plural(tasks.length, "opgave", "opgaver")} og ${plural(trades.length, "faggruppe", "faggrupper")}.` });

  // every task has a trade
  const noTrade = work.filter((t) => (t.tradeIds || []).length === 0);
  items.push(
    noTrade.length === 0
      ? { id: "trade", level: "ok", title: "Alle opgaver har en faggruppe", detail: "Det betyder, at alle opgaver kan beregnes med en pris." }
      : { id: "trade", level: "warn", title: "Alle opgaver har en faggruppe", detail: `${plural(noTrade.length, "opgave mangler", "opgaver mangler")} en faggruppe og får derfor ingen pris. Fx "${noTrade[0].title}".`, taskId: noTrade[0].id }
  );

  // double booking and role overload
  const booked = warnings.filter((w) => w.kind === "double-booking" || w.kind === "role-overload");
  items.push(
    booked.length === 0
      ? { id: "booking", level: "ok", title: "Ingen dobbeltbookinger", detail: "Ingen faggruppe skal være to steder på samme tid." }
      : { id: "booking", level: "warn", title: "Ingen dobbeltbookinger", detail: `Der er ${plural(booked.length, "dobbeltbooking", "dobbeltbookinger")}: en faggruppe er booket to steder på én gang. Brug "Ret det" i advarslerne, eller læg opgaverne efter hinanden.`, taskId: booked[0].taskIds[0] }
  );

  // stages
  if (stages.length > 0) {
    const outside = warnings.filter((w) => w.kind === "after-stage-end" || w.kind === "before-stage-start");
    items.push(
      outside.length === 0
        ? { id: "stage-dates", level: "ok", title: "Opgaverne ligger inden for deres etaper", detail: "Ingen opgave starter før eller slutter efter sin etape." }
        : { id: "stage-dates", level: "warn", title: "Opgaverne ligger inden for deres etaper", detail: `${plural(outside.length, "opgave ligger", "opgaver ligger")} uden for sin etape. Forlæng etapen, eller flyt opgaven.`, taskId: outside[0].taskIds[0] }
    );
    const noStage = work.filter((t) => !t.stageId);
    items.push(
      noStage.length === 0
        ? { id: "stage", level: "ok", title: "Alle opgaver hører til en etape", detail: "God struktur: planen kan foldes sammen etape for etape." }
        : { id: "stage", level: "info", title: "Alle opgaver hører til en etape", detail: `${plural(noStage.length, "opgave hører", "opgaver hører")} ikke til nogen etape. Det er ikke en fejl, men etaper giver overblik.`, taskId: noStage[0].id }
    );
  }

  // links between tasks
  const linkable = work.filter((t) => !t.manualStart);
  const unlinked = linkable.filter((t) => taskLinks(t).length === 0);
  // the first tasks of a plan naturally have no predecessor: allow about one in five
  const tooFree = linkable.length >= 5 && unlinked.length > Math.max(2, Math.ceil(linkable.length * 0.3));
  items.push(
    !tooFree
      ? { id: "links", level: "ok", title: "Opgaverne hænger sammen", detail: "De fleste opgaver afhænger af en anden, så en forsinkelse flytter resten." }
      : { id: "links", level: "warn", title: "Opgaverne hænger sammen", detail: `${unlinked.length} af ${linkable.length} opgaver har ingen forgænger og starter derfor ved projektstart. I en rigtig plan følger de fleste efter en anden opgave. Fx "${unlinked[0].title}".`, taskId: unlinked[0].id }
  );

  // critical path
  const critical = work.filter((t) => t.isCritical);
  if (critical.length === 0) {
    items.push({ id: "critical", level: "info", title: "Den kritiske vej", detail: "Der er ingen kritisk vej endnu. Den opstår, når opgaverne hænger sammen." });
  } else {
    const share = Math.round((critical.length / Math.max(1, work.length)) * 100);
    items.push({
      id: "critical",
      level: share > 80 && work.length > 6 ? "warn" : "info",
      title: "Den kritiske vej",
      detail:
        share > 80 && work.length > 6
          ? `${critical.length} af ${work.length} opgaver er kritiske (${share} %). Når næsten alt er kritisk, er planen meget sårbar. Kan nogle opgaver køre samtidig?`
          : `${plural(critical.length, "opgave er", "opgaver er")} på den kritiske vej (${share} %). Forsinkelser her flytter slutdatoen.`,
      taskId: critical[0].id,
    });
  }

  // price
  const noPrice = work.filter((t) => (t.tradeIds || []).length > 0 && !(t.calcCost && t.calcCost > 0));
  items.push(
    noPrice.length === 0
      ? { id: "price", level: "ok", title: "Alle opgaver har en pris", detail: "Økonomi giver derfor et samlet billede." }
      : { id: "price", level: "warn", title: "Alle opgaver har en pris", detail: `${plural(noPrice.length, "opgave har", "opgaver har")} en pris på 0 kr. Tjek timeprisen på faggruppen, fx for "${noPrice[0].title}".`, taskId: noPrice[0].id }
  );

  // milestone
  const hasMilestone = tasks.some((t) => t.isMilestone);
  items.push(
    hasMilestone
      ? { id: "milestone", level: "ok", title: "Der er en milepæl", detail: "En milepæl, fx Aflevering, gør det tydeligt, hvornår projektet er i mål." }
      : { id: "milestone", level: "info", title: "Der er en milepæl", detail: 'Der er ingen milepæl. Skriv fx "Aflevering milepæl" i hurtig-tilføj-linjen.' }
  );

  const scored = items.filter((i) => i.level !== "info");
  return { items, passed: scored.filter((i) => i.level === "ok").length, total: scored.length };
}
