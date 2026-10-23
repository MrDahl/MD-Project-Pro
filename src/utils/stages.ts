import type { Holiday, Settings, Stage, Task, Trade } from "../types.ts";
import { calculateSchedule } from "./scheduler.ts";

/** Sets each stage's dates from the calculated plan, so new stages start without warnings. */
export function fitStageDates(tasks: Task[], trades: Trade[], holidays: Holiday[], settings: Settings, startDate: string, stages: Stage[], only?: ReadonlySet<string>): Stage[] {
  const plan = calculateSchedule(tasks, trades, holidays, settings, startDate, [], []);
  return stages.map((stage) => {
    if (only && !only.has(stage.id)) return stage;
    const inStage = plan.tasks.filter((t) => t.stageId === stage.id && t.calcStart && t.calcEnd);
    if (inStage.length === 0) return stage;
    return {
      ...stage,
      startDate: inStage.reduce((m, t) => (t.calcStart! < m ? t.calcStart! : m), inStage[0].calcStart!),
      endDate: inStage.reduce((m, t) => (t.calcEnd! > m ? t.calcEnd! : m), inStage[0].calcEnd!),
    };
  });
}
