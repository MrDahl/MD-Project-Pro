import { test } from "node:test";
import assert from "node:assert/strict";
import type { Task, Trade, WeekSchedule } from "../types.ts";
import { calculateSchedule } from "./scheduler.ts";
import { exampleWeek, formatTime, hoursOfDay, makeWeek, parseTime, resolveWeek, weekdayAverageHours, windowsOf } from "./worktime.ts";

const trade = (over: Partial<Trade> = {}): Trade => ({ id: "t", name: "Tømrer", rate: 500, isFixedPrice: false, weekendSupplement: 50, holidaySupplement: 100, color: "#000", ...over });
const task = (id: string, over: Partial<Task> = {}): Task => ({ id, title: id, desc: "", duration: 1, manualStart: null, tradeIds: ["t"], dependencyId: null, allowWeekend: false, allowHoliday: false, ...over });
const link = (id: string, type: "FS" | "SS" = "FS", lag = 0) => ({ dependencyId: id, dependencies: [{ taskId: id, type, lag }] });
const run = (tasks: Task[], opts: { trades?: Trade[]; week?: WeekSchedule; hours?: number; holidays?: { id: string; date: string; name: string }[] } = {}) =>
  calculateSchedule(tasks, opts.trades ?? [trade()], opts.holidays ?? [], { workHoursPerDay: opts.hours ?? 7.4, workWeek: opts.week }, "2026-06-22", [], []); // a Monday
const get = (r: ReturnType<typeof run>, id: string) => r.tasks.find((t) => t.id === id)!;
const at = (t: Task) => `${t.calcStart} ${formatTime(t.calcStartMin!)}-${t.calcEnd} ${formatTime(t.calcEndMin!)}`;

test("time helpers", () => {
  assert.equal(parseTime("06:30"), 390);
  assert.equal(parseTime("6.30"), 390);
  assert.equal(parseTime("25:00"), null);
  assert.equal(parseTime("abc"), null);
  assert.equal(formatTime(870), "14:30");
  assert.deepEqual(windowsOf({ start: 360, end: 870, breaks: [{ from: 540, to: 555 }, { from: 690, to: 720 }] }), [[360, 540], [555, 690], [720, 870]]);
  const w = exampleWeek();
  assert.equal(hoursOfDay(w[1]), 7.75);
  assert.equal(hoursOfDay(w[5]), 7.25);
  assert.equal(w[0], null);
  assert.ok(Math.abs(weekdayAverageHours(w) - (4 * 7.75 + 7.25) / 5) < 1e-9);
  assert.equal(resolveWeek(undefined, 7.4)[3]!.minutes, 444);
  assert.equal(resolveWeek(w, 7.4)[6]!.minutes, 7.75 * 60, "weekend off falls back to Monday (only used when weekend work is allowed)");
});

test("without any hour features every task starts at 07:00 and uses whole days", () => {
  const r = run([task("a", { duration: 2 })]);
  assert.equal(at(get(r, "a")), "2026-06-22 07:00-2026-06-23 14:24");
  assert.equal(get(r, "a").calcHours, 14.8);
});

test("4 hours of milling and 2 hours of cleaning follow each other on the same day", () => {
  const r = run([task("mill", { durationHours: 4 }), task("clean", { durationHours: 2, ...link("mill") })]);
  assert.equal(at(get(r, "mill")), "2026-06-22 07:00-2026-06-22 11:00");
  assert.equal(at(get(r, "clean")), "2026-06-22 11:00-2026-06-22 13:00");
  assert.equal(get(r, "mill").calcCost, 4 * 500);
  assert.equal(get(r, "clean").calcCost, 2 * 500);
  assert.equal(get(r, "clean").calcHours, 2);
});

test("an hour task that does not fit continues on the next working day", () => {
  const r = run([task("a", { durationHours: 4 }), task("b", { durationHours: 6, ...link("a") })]);
  assert.equal(at(get(r, "b")), "2026-06-22 11:00-2026-06-23 09:36"); // 3.4 h today, 2.6 h tomorrow
  assert.equal(get(r, "b").calcCost, 6 * 500);
});

test("breaks are skipped and the weekday hours decide when the day ends", () => {
  const week = exampleWeek(); // 06:00-14:30, breaks 09:00-09:15 and 11:30-12:00; Friday ends 14:00
  const r = run([task("a", { durationHours: 3.5 }), task("fri", { durationHours: 1, manualStart: "2026-06-26", startTime: 13 * 60 })], { week });
  assert.equal(at(get(r, "a")), "2026-06-22 06:00-2026-06-22 09:45"); // 3 h to 09:00, break, 0.5 h
  assert.equal(at(get(r, "fri")), "2026-06-26 13:00-2026-06-26 14:00");
  const next = run([task("a", { durationHours: 1, manualStart: "2026-06-26", startTime: 13 * 60 + 30 })], { week });
  assert.equal(at(get(next, "a")), "2026-06-26 13:30-2026-06-29 06:30", "friday ends 14:00, the other half hour moves to Monday");
});

test("day-based tasks follow the week: Mon-Thu 7.75 h and Friday 7.25 h", () => {
  const r = run([task("a", { duration: 5 })], { week: exampleWeek() });
  assert.equal(get(r, "a").calcHours, 4 * 7.75 + 7.25);
  assert.equal(get(r, "a").calcCost, (4 * 7.75 + 7.25) * 500);
  assert.equal(at(get(r, "a")), "2026-06-22 06:00-2026-06-26 14:00");
});

test("a trade's own hours override the project's, for that trade only", () => {
  const early: Trade = trade({ id: "early", name: "Tidlig", workWeek: makeWeek({ start: 6 * 60, end: 14 * 60, breaks: [] }, undefined, null) });
  const r = run([task("a", { duration: 1, tradeIds: ["early"] }), task("b", { duration: 1, tradeIds: ["t"] })], { trades: [trade(), early] });
  assert.equal(at(get(r, "a")), "2026-06-22 06:00-2026-06-22 14:00");
  assert.equal(get(r, "a").calcCost, 8 * 500);
  assert.equal(at(get(r, "b")), "2026-06-22 07:00-2026-06-22 14:24");
  assert.equal(get(r, "b").calcCost, 7.4 * 500);
});

test("day-based successor of an hour task starts the next day; hour task after a day task starts the next morning", () => {
  const r = run([task("h", { durationHours: 2 }), task("d", { duration: 1, ...link("h") }), task("h2", { durationHours: 1, ...link("d") })]);
  assert.equal(get(r, "d").calcStart, "2026-06-23");
  assert.equal(at(get(r, "h2")), "2026-06-24 07:00-2026-06-24 08:00");
});

test("weekends and holidays are skipped for hour tasks, unless allowed", () => {
  const r = run([task("a", { durationHours: 10 })], { holidays: [{ id: "h", date: "2026-06-23", name: "Fri" }] });
  // Mon 7.4 h, Tue holiday, Wed 2.6 h
  assert.equal(at(get(r, "a")), "2026-06-22 07:00-2026-06-24 09:36");
  const weekend = run([task("a", { durationHours: 2, manualStart: "2026-06-27", allowWeekend: true })]);
  assert.equal(at(get(weekend, "a")), "2026-06-27 07:00-2026-06-27 09:00");
  assert.equal(get(weekend, "a").calcCost, 2 * 500 * 1.5);
  const skipped = run([task("a", { durationHours: 2, manualStart: "2026-06-27" })]);
  assert.equal(get(skipped, "a").calcStart, "2026-06-29");
});

test("crew with hours per person; role with own hours on day tasks", () => {
  const withRoles: Trade = trade({
    roles: [
      { id: "svend", name: "Svend", count: 2, rate: 450 },
      { id: "laer", name: "Lærling", count: 2, rate: 200, workWeek: makeWeek({ start: 8 * 60, end: 14 * 60, breaks: [] }) },
    ],
  });
  const a = task("a", {
    duration: 2,
    assignments: [
      { id: "k", tradeId: "t", label: "Rillefræsning", crew: [{ roleId: "svend", count: 2 }], hours: 3 },
      { id: "l", tradeId: "t", label: "Oprydning", crew: [{ roleId: "laer", count: 1 }] },
    ],
  });
  const r = get(run([a], { trades: [withRoles] }), "a");
  assert.ok(Math.abs(r.assignmentCosts!.k - 3 * 2 * 450) < 1e-6, "3 h x 2 svende regardless of task length");
  assert.ok(Math.abs(r.assignmentCosts!.l - 2 * 6 * 200) < 1e-6, "apprentice works 6 h/day on both days");
  assert.ok(Math.abs(r.roleHours!.svend - 6) < 1e-6);
});

test("critical path follows the clock for hour tasks", () => {
  const r = run([task("a", { durationHours: 4 }), task("b", { durationHours: 2, ...link("a") }), task("c", { durationHours: 3, ...link("a") })]);
  assert.equal(get(r, "b").isCritical, false);
  assert.equal(get(r, "c").isCritical, true);
  assert.equal(get(r, "a").isCritical, true);
});

test("no double-booking warning for hour tasks that follow each other, warning when the clock overlaps", async () => {
  const { findWarnings } = await import("./warnings.ts");
  const seq = run([task("a", { durationHours: 4 }), task("b", { durationHours: 2, ...link("a") })]);
  assert.equal(findWarnings(seq.tasks, [trade()], []).filter((w) => w.kind === "double-booking").length, 0);
  const par = run([task("a", { durationHours: 4 }), task("b", { durationHours: 2 })]);
  const w = findWarnings(par.tasks, [trade()], []).filter((x) => x.kind === "double-booking");
  assert.equal(w.length, 1);
  assert.match(w[0].message, /kl\. 7:00-9:00/);
});
