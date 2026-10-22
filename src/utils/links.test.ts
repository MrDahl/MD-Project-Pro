import { test } from "node:test";
import assert from "node:assert/strict";
import type { Task } from "../types.ts";
import { calculateSchedule, detectCycle } from "./scheduler.ts";
import { descendantsOf, removeLinksTo, taskLinks, withLinks } from "./links.ts";

const task = (id: string, over: Partial<Task> = {}): Task => ({
  id, title: id, desc: "", duration: 1, manualStart: null, tradeIds: [], dependencyId: null, allowWeekend: false, allowHoliday: false, ...over,
});
const START = "2026-06-22"; // Monday
const run = (tasks: Task[]) => calculateSchedule(tasks, [], [], { workHoursPerDay: 7.4 }, START, [], []);
const get = (r: ReturnType<typeof run>, id: string) => r.tasks.find((t) => t.id === id)!;

test("taskLinks: legacy dependencyId becomes one FS link", () => {
  assert.deepEqual(taskLinks(task("a", { dependencyId: "x" })), [{ taskId: "x", type: "FS", lag: 0 }]);
  assert.deepEqual(taskLinks(task("a")), []);
});

test("taskLinks: dependencies array wins, is sanitised and de-duplicated", () => {
  const t = task("a", { dependencyId: "old", dependencies: [{ taskId: "x", type: "SS", lag: 2.7 }, { taskId: "x", type: "FS", lag: 0 }, { taskId: "", type: "FS", lag: 0 }, { taskId: "y", type: "FS", lag: NaN }] });
  assert.deepEqual(taskLinks(t), [{ taskId: "x", type: "SS", lag: 2 }, { taskId: "y", type: "FS", lag: 0 }]);
});

test("withLinks / removeLinksTo keep dependencyId in sync", () => {
  const t = withLinks(task("a"), [{ taskId: "x", type: "FS", lag: 0 }, { taskId: "y", type: "SS", lag: 1 }]);
  assert.equal(t.dependencyId, "x");
  const r = removeLinksTo(t, "x");
  assert.equal(r.dependencyId, "y");
  assert.equal(removeLinksTo(r, "zzz"), r);
  assert.equal(removeLinksTo(r, "y").dependencyId, null);
});

test("FS with lag adds calendar days after the predecessor", () => {
  // a: Mon 22 -> Tue 23. b FS+3 -> earliest Sat 27 -> skips weekend -> Mon 29
  const r = run([task("a", { duration: 2 }), withLinks(task("b"), [{ taskId: "a", type: "FS", lag: 3 }])]);
  assert.equal(get(r, "b").calcStart, "2026-06-29");
});

test("FS with lead (negative lag) starts before the predecessor ends", () => {
  const r = run([task("a", { duration: 4 }), withLinks(task("b"), [{ taskId: "a", type: "FS", lag: -2 }])]);
  // a: 22-25, b earliest = 25+1-2 = 24
  assert.equal(get(r, "b").calcStart, "2026-06-24");
});

test("SS starts together with the predecessor (plus lag)", () => {
  const r = run([task("a", { duration: 5 }), withLinks(task("b", { duration: 2 }), [{ taskId: "a", type: "SS", lag: 0 }]), withLinks(task("c"), [{ taskId: "a", type: "SS", lag: 2 }])]);
  assert.equal(get(r, "b").calcStart, "2026-06-22");
  assert.equal(get(r, "c").calcStart, "2026-06-24");
});

test("several predecessors: the latest constraint decides", () => {
  const r = run([
    task("a", { duration: 2 }), // ends 23
    task("b", { duration: 5 }), // ends 26
    withLinks(task("c"), [{ taskId: "a", type: "FS", lag: 0 }, { taskId: "b", type: "FS", lag: 0 }]),
  ]);
  assert.equal(get(r, "c").calcStart, "2026-06-29"); // after b: Fri 26 + 1 = Sat -> Mon 29
});

test("critical path follows only the driving predecessors", () => {
  const r = run([
    task("short", { duration: 1 }),
    task("long", { duration: 6 }),
    withLinks(task("end"), [{ taskId: "short", type: "FS", lag: 0 }, { taskId: "long", type: "FS", lag: 0 }]),
  ]);
  assert.equal(get(r, "long").isCritical, true);
  assert.equal(get(r, "end").isCritical, true);
  assert.equal(get(r, "short").isCritical, false);
});

test("a manual start later than the links still wins", () => {
  const r = run([task("a"), withLinks(task("b", { manualStart: "2026-07-01" }), [{ taskId: "a", type: "FS", lag: 0 }])]);
  assert.equal(get(r, "b").calcStart, "2026-07-01");
});

test("cycles through several predecessors are detected", () => {
  const ts = [task("a"), withLinks(task("b"), [{ taskId: "a", type: "FS", lag: 0 }]), withLinks(task("c"), [{ taskId: "b", type: "FS", lag: 0 }, { taskId: "a", type: "SS", lag: 0 }])];
  assert.equal(detectCycle(ts), false);
  ts[0] = withLinks(ts[0], [{ taskId: "c", type: "SS", lag: 0 }]);
  assert.equal(detectCycle(ts), true);
  assert.match(run(ts).scheduleError ?? "", /Cyklus/);
});

test("self link is a cycle", () => {
  assert.equal(detectCycle([withLinks(task("a"), [{ taskId: "a", type: "FS", lag: 0 }])]), true);
});

test("links to unknown or recurring tasks are ignored", () => {
  const r = run([task("rec", { isRecurring: true, recurringInterval: 7 }), withLinks(task("a"), [{ taskId: "ghost", type: "FS", lag: 5 }, { taskId: "rec", type: "FS", lag: 5 }])]);
  assert.equal(get(r, "a").calcStart, START);
});

test("descendantsOf walks all links", () => {
  const ts = [task("a"), withLinks(task("b"), [{ taskId: "a", type: "FS", lag: 0 }]), withLinks(task("c"), [{ taskId: "b", type: "SS", lag: 0 }]), task("d")];
  assert.deepEqual([...descendantsOf(ts, "a")].sort(), ["b", "c"]);
});
