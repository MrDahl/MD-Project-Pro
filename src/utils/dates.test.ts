import { test } from "node:test";
import assert from "node:assert/strict";
import { addDaysStr, defaultStageDates, industryHolidayDays, nextMonday, todayStr } from "./dates.ts";

test("nextMonday returns the coming Monday, or today when it is Monday", () => {
  assert.equal(nextMonday(new Date(2026, 9, 22)), "2026-10-26"); // Thursday
  assert.equal(nextMonday(new Date(2026, 9, 26)), "2026-10-26"); // Monday
  assert.equal(nextMonday(new Date(2026, 9, 25)), "2026-10-26"); // Sunday
  assert.equal(nextMonday(new Date(2026, 11, 31)), "2027-01-04"); // across the year boundary
});

test("todayStr uses the local calendar date", () => {
  assert.equal(todayStr(new Date(2026, 0, 5, 23, 59)), "2026-01-05");
});

test("addDaysStr handles month and year ends", () => {
  assert.equal(addDaysStr("2026-12-31", 1), "2027-01-01");
  assert.equal(addDaysStr("2026-03-01", -1), "2026-02-28");
  assert.equal(addDaysStr("broken", 5), "broken");
});

test("industry holidays for 2026 are weeks 29-31 (13-31 July), weekdays only", () => {
  const days = industryHolidayDays(2026);
  assert.equal(days.length, 15);
  assert.equal(days[0], "2026-07-13");
  assert.equal(days[14], "2026-07-31");
  assert.ok(!days.includes("2026-07-18")); // Saturday
});

test("default stage dates follow the start date", () => {
  const d = defaultStageDates("2026-06-22");
  assert.deepEqual(d, {
    prepStartDate: "2026-06-22",
    prepEndDate: "2026-07-05",
    rawStartDate: "2026-07-06",
    rawEndDate: "2026-08-16",
    finishStartDate: "2026-08-17",
    finishEndDate: "2026-09-04",
  });
  assert.equal(defaultStageDates("2027-01-04").prepStartDate, "2027-01-04");
});
