import { test } from "node:test";
import assert from "node:assert/strict";
import type { Task, Trade } from "../types.ts";
import { calculateSchedule } from "./scheduler.ts";
import { findWarnings } from "./warnings.ts";
import { cleanAssignments, crewHourly, resourceReport, teamHourly } from "./roles.ts";
import { duplicateTask } from "./taskFilter.ts";

const el: Trade = {
  id: "el",
  name: "Elektriker",
  rate: 500,
  isFixedPrice: false,
  weekendSupplement: 50,
  holidaySupplement: 100,
  color: "#c00",
  roles: [
    { id: "svend", name: "Svend", count: 2, rate: 450 },
    { id: "laer", name: "Lærling", count: 3, rate: 200 },
    { id: "over", name: "Overmontør", count: 1, rate: 600 },
  ],
};
const task = (id: string, over: Partial<Task> = {}): Task => ({
  id, title: id, desc: "", duration: 2, manualStart: null, tradeIds: ["el"], dependencyId: null, allowWeekend: false, allowHoliday: false, ...over,
});
const run = (tasks: Task[]) => calculateSchedule(tasks, [el], [], { workHoursPerDay: 8 }, "2026-06-22", [], []);

test("without crews the trade standard rate is used (unchanged behaviour)", () => {
  const r = run([task("a")]);
  assert.equal(r.tasks[0].calcCost, 2 * 8 * 500);
  assert.deepEqual(r.tasks[0].roleCosts, {});
});

test("crews are paid per role and replace the standard rate", () => {
  const a = task("a", {
    assignments: [
      { id: "k", tradeId: "el", label: "Kabeltræk", crew: [{ roleId: "laer", count: 2 }] },
      { id: "r", tradeId: "el", label: "Rillefræsning", crew: [{ roleId: "svend", count: 1 }], percent: 50 },
      { id: "p", tradeId: "el", label: "Planlægning", crew: [{ roleId: "over", count: 1 }], percent: 25 },
    ],
  });
  const t = run([a]).tasks[0];
  assert.equal(t.assignmentCosts!.k, 2 * 8 * 2 * 200); // 2 days x 8 h x 2 apprentices
  assert.equal(t.assignmentCosts!.r, 2 * 8 * 0.5 * 450);
  assert.equal(t.assignmentCosts!.p, 2 * 8 * 0.25 * 600);
  assert.equal(t.calcCost, 6400 + 3600 + 2400);
  assert.equal(t.tradeCosts!.el, t.calcCost);
  assert.equal(t.roleHours!.laer, 32);
  assert.equal(t.roleCosts!.svend, 3600);
});

test("weekend supplement applies to crew cost", () => {
  const a = task("a", { duration: 1, manualStart: "2026-06-27", allowWeekend: true, assignments: [{ id: "k", tradeId: "el", label: "", crew: [{ roleId: "svend", count: 1 }] }] });
  assert.equal(run([a]).tasks[0].calcCost, 8 * 450 * 1.5);
});

test("fixed price trades ignore crews, unknown roles cost nothing", () => {
  const fixed: Trade = { ...el, isFixedPrice: true, rate: 9000 };
  const a = task("a", { assignments: [{ id: "k", tradeId: "el", label: "", crew: [{ roleId: "svend", count: 5 }] }] });
  assert.equal(calculateSchedule([a], [fixed], [], { workHoursPerDay: 8 }, "2026-06-22", [], []).tasks[0].calcCost, 9000);
  const b = task("b", { assignments: [{ id: "k", tradeId: "el", label: "", crew: [{ roleId: "ghost", count: 5 }] }] });
  assert.equal(run([b]).tasks[0].calcCost, 0);
});

test("a trade that only appears in a crew is still costed", () => {
  const a = task("a", { tradeIds: [], assignments: [{ id: "k", tradeId: "el", label: "x", crew: [{ roleId: "over", count: 1 }] }] });
  assert.equal(run([a]).tasks[0].calcCost, 2 * 8 * 600);
});

test("helpers: crewHourly, teamHourly, cleanAssignments", () => {
  assert.equal(crewHourly({ crew: [{ roleId: "svend", count: 2 }, { roleId: "laer", count: 1 }] }, el.roles), 1100);
  assert.equal(teamHourly(el), 2 * 450 + 3 * 200 + 600);
  const cleaned = cleanAssignments(
    [
      { id: "1", tradeId: "el", label: "ok", crew: [{ roleId: "svend", count: 1 }, { roleId: "gone", count: 1 }] },
      { id: "2", tradeId: "el", label: "tom", crew: [{ roleId: "gone", count: 1 }] },
      { id: "3", tradeId: "nope", label: "x", crew: [{ roleId: "svend", count: 1 }] },
    ],
    [el]
  )!;
  assert.equal(cleaned.length, 1);
  assert.equal(cleaned[0].crew.length, 1);
  assert.equal(cleanAssignments([], [el]), undefined);
});

test("resourceReport splits cost by role, activity and stage", () => {
  const tasks = [
    task("a", { stageId: "s1", assignments: [{ id: "a1", tradeId: "el", label: "Kabeltræk", crew: [{ roleId: "laer", count: 2 }] }] }),
    task("b", { stageId: "s2", assignments: [{ id: "b1", tradeId: "el", label: "Kabeltræk", crew: [{ roleId: "laer", count: 1 }, { roleId: "svend", count: 1 }] }] }),
    task("c", { stageId: "s2" }),
  ];
  const calc = run(tasks).tasks;
  const all = resourceReport(calc, el);
  assert.equal(all.total, calc.reduce((s, t) => s + (t.calcCost || 0), 0));
  assert.equal(all.byActivity.length, 1);
  assert.equal(all.byActivity[0].tasks, 2);
  assert.equal(all.unstaffed, 2 * 8 * 500);
  assert.equal(all.byRole.find((r) => r.roleId === "laer")!.hours, 2 * 8 * 2 + 2 * 8);
  const s1 = resourceReport(calc, el, "s1");
  assert.equal(s1.byTask.length, 1);
  assert.equal(s1.total, 2 * 8 * 2 * 200);
});

test("duplicating a task copies crews with new ids", () => {
  const a = task("a", { assignments: [{ id: "k", tradeId: "el", label: "x", crew: [{ roleId: "svend", count: 1 }] }] });
  const d = duplicateTask(a, "a2");
  assert.equal(d.assignments![0].id, "a2-a1");
  d.assignments![0].crew[0].count = 9;
  assert.equal(a.assignments![0].crew[0].count, 1);
});

test("warning when more of a role is needed at once than the trade has", () => {
  const crew = (n: number) => [{ id: "x", tradeId: "el", label: "", crew: [{ roleId: "svend", count: n }] }];
  const tasks = [
    task("a", { assignments: crew(2) }),
    task("b", { assignments: [{ id: "y", tradeId: "el", label: "", crew: [{ roleId: "svend", count: 1 }] }] }),
  ];
  const calc = run(tasks).tasks; // both start Monday => 3 svende needed, 2 exist
  const w = findWarnings(calc, [el], []).filter((x) => x.kind === "role-overload");
  assert.equal(w.length, 1);
  assert.match(w[0].message, /3 svend/);
  assert.equal(findWarnings(calc, [el], []).filter((x) => x.kind === "double-booking").length, 0);

  const ok = run([task("a", { assignments: crew(2) }), task("b", { dependencyId: "a", assignments: crew(2) })]).tasks;
  assert.equal(findWarnings(ok, [el], []).filter((x) => x.kind === "role-overload").length, 0);
});
