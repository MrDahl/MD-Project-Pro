import { test } from "node:test";
import assert from "node:assert/strict";
import type { Task, Trade, Holiday, WeatherDelay } from "../types.ts";
import { calculateSchedule, detectCycle, dayNumber, dayToStr, weekdayOf } from "./scheduler.ts";

const task = (id: string, over: Partial<Task> = {}): Task => ({
  id,
  title: id,
  desc: "",
  duration: 1,
  manualStart: null,
  tradeIds: [],
  dependencyId: null,
  allowWeekend: false,
  allowHoliday: false,
  ...over,
});

const trade: Trade = {
  id: "tr",
  name: "Tømrer",
  rate: 500,
  isFixedPrice: false,
  weekendSupplement: 50,
  holidaySupplement: 100,
  color: "#000",
};

const settings = { workHoursPerDay: 7.4 };
const START = "2026-06-22"; // a Monday

const run = (tasks: Task[], opts: { holidays?: Holiday[]; weather?: WeatherDelay[]; trades?: Trade[]; start?: string } = {}) =>
  calculateSchedule(tasks, opts.trades ?? [trade], opts.holidays ?? [], settings, opts.start ?? START, [], opts.weather ?? []);

const byId = (r: ReturnType<typeof run>, id: string) => r.tasks.find((t) => t.id === id)!;

test("day helpers round-trip across the October daylight-saving change", () => {
  const d = dayNumber("2026-10-25")!;
  assert.equal(dayToStr(d + 1), "2026-10-26");
  assert.equal(dayToStr(d + 2), "2026-10-27");
  assert.equal(weekdayOf(dayNumber("2026-06-22")!), 1); // Monday
  assert.equal(dayNumber("2026-02-30"), null);
  assert.equal(dayNumber("not a date"), null);
});

test("successor starts the day after its predecessor and skips the weekend", () => {
  const r = run([task("A", { duration: 5 }), task("B", { duration: 2, dependencyId: "A" })]);
  assert.equal(byId(r, "A").calcStart, "2026-06-22");
  assert.equal(byId(r, "A").calcEnd, "2026-06-26");
  assert.equal(byId(r, "B").calcStart, "2026-06-29");
  assert.equal(byId(r, "B").calcEnd, "2026-06-30");
  assert.equal(r.projectEndDate, "2026-06-30");
});

test("order of tasks in the list does not matter", () => {
  const r = run([task("B", { duration: 2, dependencyId: "A" }), task("A", { duration: 5 })]);
  assert.equal(byId(r, "B").calcStart, "2026-06-29");
});

test("duration counts working days only (weekend skipped)", () => {
  const r = run([task("A", { duration: 4, manualStart: "2026-06-24" })]);
  assert.equal(byId(r, "A").calcEnd, "2026-06-29"); // Wed, Thu, Fri, Mon
});

test("holidays are skipped unless the task allows work on holidays", () => {
  const holidays: Holiday[] = [{ id: "h", date: "2026-06-25", name: "Test" }];
  const blocked = run([task("A", { duration: 3, manualStart: "2026-06-24" })], { holidays });
  assert.equal(byId(blocked, "A").calcEnd, "2026-06-29");
  const allowed = run([task("A", { duration: 3, manualStart: "2026-06-24", allowHoliday: true })], { holidays });
  assert.equal(byId(allowed, "A").calcEnd, "2026-06-26");
});

test("weekend work is only scheduled when allowed", () => {
  const r = run([task("A", { duration: 7, allowWeekend: true })]);
  assert.equal(byId(r, "A").calcEnd, "2026-06-28");
});

test("weather delays pause sensitive tasks but not independent ones", () => {
  const weather: WeatherDelay[] = [{ id: "w", label: "Frost", startDate: "2026-06-23", endDate: "2026-06-24" }];
  const sensitive = run([task("A", { duration: 3 })], { weather });
  assert.equal(byId(sensitive, "A").calcEnd, "2026-06-26"); // Mon, Thu, Fri
  const independent = run([task("A", { duration: 3, weatherIndependent: true })], { weather });
  assert.equal(byId(independent, "A").calcEnd, "2026-06-24");
});

test("cost: hourly rate x hours per day, with weekend supplement", () => {
  const weekdays = run([task("A", { duration: 2, tradeIds: ["tr"] })]);
  assert.equal(byId(weekdays, "A").calcCost, 2 * 7.4 * 500);

  // Saturday start with weekend work allowed: 50 % supplement for that day
  const weekend = run([task("A", { duration: 1, manualStart: "2026-06-27", allowWeekend: true, tradeIds: ["tr"] })]);
  assert.equal(byId(weekend, "A").calcCost, 7.4 * 500 * 1.5);
});

test("fixed-price trades are charged once", () => {
  const fixed: Trade = { ...trade, id: "fx", isFixedPrice: true, rate: 12000 };
  const r = run([task("A", { duration: 5, tradeIds: ["fx"] })], { trades: [fixed] });
  assert.equal(byId(r, "A").calcCost, 12000);
  assert.equal(r.projectTotalCost, 12000);
});

test("milestones take no time and cost nothing", () => {
  const r = run([task("A", { duration: 3 }), task("M", { isMilestone: true, dependencyId: "A", tradeIds: ["tr"] })]);
  assert.equal(byId(r, "M").calcStart, byId(r, "M").calcEnd);
  assert.equal(byId(r, "M").calcCost, 0);
});

test("critical path follows the longest chain", () => {
  const r = run([
    task("A", { duration: 2 }),
    task("B", { duration: 6, dependencyId: "A" }),
    task("C", { duration: 1, dependencyId: "A" }),
  ]);
  assert.equal(byId(r, "A").isCritical, true);
  assert.equal(byId(r, "B").isCritical, true);
  assert.equal(byId(r, "C").isCritical, false);
});

test("recurring tasks repeat over the project and are priced per occurrence", () => {
  const r = run([
    task("A", { duration: 15, allowWeekend: true }), // Mon 22 Jun .. Mon 6 Jul
    task("R", { isRecurring: true, recurringInterval: 7, recurringPrice: 250 }),
  ]);
  const rec = byId(r, "R");
  assert.deepEqual(rec.occurrences, ["2026-06-22", "2026-06-29", "2026-07-06"]);
  assert.equal(rec.calcCost, 750);
});

test("circular dependencies are reported instead of looping", () => {
  const tasks = [task("A", { dependencyId: "B" }), task("B", { dependencyId: "A" })];
  assert.equal(detectCycle(tasks), true);
  const r = run(tasks);
  assert.match(r.scheduleError ?? "", /Cyklus/);
  assert.equal(r.projectEndDate, null);
  assert.equal(detectCycle([task("S", { dependencyId: "S" })]), true);
  assert.equal(detectCycle([task("A"), task("B", { dependencyId: "A" })]), false);
});

test("a dependency on a missing task is ignored", () => {
  const r = run([task("A", { duration: 2, dependencyId: "ghost" })]);
  assert.equal(byId(r, "A").calcStart, START);
});

test("missing project start date is reported unless a task has one", () => {
  assert.match(run([task("A")], { start: "" }).scheduleError ?? "", /startdato/);
  const ok = run([task("A", { manualStart: "2026-07-01" })], { start: "" });
  assert.equal(ok.scheduleError, null);
  assert.equal(byId(ok, "A").calcStart, "2026-07-01");
});

test("warns when a task starts before the project", () => {
  const r = run([task("A", { manualStart: "2026-06-01" })]);
  assert.match(r.startDateWarning ?? "", /før projektets startdato/);
});

test("does not mutate its input", () => {
  const input = [task("A", { duration: 3 })];
  const snapshot = JSON.stringify(input);
  run(input);
  assert.equal(JSON.stringify(input), snapshot);
});

test("handles thousands of chained tasks quickly", () => {
  const n = 5000;
  const tasks = Array.from({ length: n }, (_, i) => task(`t${i}`, { duration: 2, dependencyId: i ? `t${i - 1}` : null }));
  const t0 = performance.now();
  const r = run(tasks);
  const ms = performance.now() - t0;
  assert.ok(r.projectEndDate);
  assert.ok(ms < 1000, `took ${ms.toFixed(0)} ms`);
});
