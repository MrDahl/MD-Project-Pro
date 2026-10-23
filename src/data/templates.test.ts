import { test } from "node:test";
import assert from "node:assert/strict";
import { TEMPLATE_LIST, buildTemplate } from "./templates.ts";
import { calculateSchedule, detectCycle } from "../utils/scheduler.ts";
import { findWarnings } from "../utils/warnings.ts";
import { nextMonday } from "../utils/dates.ts";

test("there are five templates and an unknown id gives null", () => {
  assert.equal(TEMPLATE_LIST.length, 5);
  assert.equal(buildTemplate("nope", "2026-06-22"), null);
});

for (const info of TEMPLATE_LIST) {
  test(`template "${info.id}" is a valid, warning-free plan`, () => {
    const start = nextMonday(new Date("2026-10-22T12:00:00"));
    const p = buildTemplate(info.id, start)!;
    assert.ok(p.tasks.length >= 8);
    assert.equal(new Set(p.tasks.map((t) => t.id)).size, p.tasks.length, "unique task ids");
    assert.equal(detectCycle(p.tasks), false);

    const r = calculateSchedule(p.tasks, p.trades, p.holidays, p.settings, p.startDate, p.stages, []);
    assert.equal(r.scheduleError, null);
    assert.ok(r.tasks.every((t) => t.calcStart && t.calcEnd), "all tasks scheduled");
    assert.equal(r.tasks[0].calcStart, start);
    assert.ok(r.projectTotalCost > 0);
    assert.ok(r.tasks.some((t) => t.isCritical));

    const tradeIds = new Set(p.trades.map((t) => t.id));
    assert.ok(p.tasks.every((t) => t.tradeIds.every((id) => tradeIds.has(id))), "tasks only use existing trades");
    const stageIds = new Set(p.stages!.map((s) => s.id));
    assert.ok(p.tasks.every((t) => t.stageId && stageIds.has(t.stageId)));

    const bad = findWarnings(r.tasks, p.trades, p.stages!).filter((w) => w.kind !== "double-booking");
    assert.deepEqual(bad, []);
  });
}
