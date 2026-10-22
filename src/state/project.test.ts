import { test } from "node:test";
import assert from "node:assert/strict";
import { looksLikeProject, normalizeProject } from "./project.ts";

test("normalize accepts the current format and keeps stages and weather delays", () => {
  const p = normalizeProject({
    startDate: "2026-06-22",
    settings: { workHoursPerDay: 8 },
    projectInfo: { projectName: "X", address: "a", customer: "c", manager: "m" },
    holidays: [{ id: "h", date: "2026-06-24", name: "Ferie" }],
    trades: [{ id: "t" }],
    tasks: [{ id: "a", title: "A", desc: "", duration: 2, manualStart: null, tradeIds: [], dependencyId: null, allowWeekend: false, allowHoliday: false }],
    stages: [{ id: "s" }],
    weatherDelays: [{ id: "w" }],
  });
  assert.equal(p.settings.workHoursPerDay, 8);
  assert.equal(p.stages?.length, 1);
  assert.equal(p.weatherDelays?.length, 1);
  assert.equal(p.holidays[0].name, "Ferie");
});

test("normalize upgrades legacy string holidays", () => {
  const p = normalizeProject({ holidays: ["2026-12-24", "", null], tasks: [], trades: [] });
  assert.equal(p.holidays.length, 1);
  assert.equal(p.holidays[0].date, "2026-12-24");
  assert.equal(p.holidays[0].name, "Lukkedag / Ferie");
});

test("normalize strips calculated fields and repairs tasks", () => {
  const p = normalizeProject({ tasks: [{ id: "a", title: "A", calcStart: "2026-01-01", isCritical: true, tradeCosts: { x: 1 } }, { title: "no id" }, "junk"], trades: [] });
  assert.equal(p.tasks.length, 2);
  assert.equal("calcStart" in p.tasks[0], false);
  assert.equal("isCritical" in p.tasks[0], false);
  assert.ok(p.tasks[1].id);
  assert.deepEqual(p.tasks[1].tradeIds, []);
});

test("normalize survives garbage and invalid values", () => {
  for (const junk of [null, undefined, 5, "x", [], {}]) {
    const p = normalizeProject(junk);
    assert.ok(Array.isArray(p.tasks) && Array.isArray(p.trades));
    assert.match(p.startDate, /^\d{4}-\d{2}-\d{2}$/);
  }
  const p = normalizeProject({ startDate: "31/12/2026", settings: { workHoursPerDay: -3 } });
  assert.match(p.startDate, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(p.settings.workHoursPerDay, 7.4);
});

test("looksLikeProject needs tasks and trades arrays", () => {
  assert.equal(looksLikeProject({ tasks: [], trades: [] }), true);
  assert.equal(looksLikeProject({ tasks: [] }), false);
  assert.equal(looksLikeProject(null), false);
});
