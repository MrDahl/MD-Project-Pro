import { test } from "node:test";
import assert from "node:assert/strict";
import { danishHolidays, projectYears } from "./holidays.ts";

const easter: Record<number, string> = {
  2020: "2020-04-12", 2021: "2021-04-04", 2022: "2022-04-17", 2023: "2023-04-09", 2024: "2024-03-31",
  2025: "2025-04-20", 2026: "2026-04-05", 2027: "2027-03-28", 2028: "2028-04-16", 2029: "2029-04-01", 2030: "2030-04-21",
};

test("Easter-based holidays are correct for 2020-2030", () => {
  for (const [year, date] of Object.entries(easter)) {
    const found = danishHolidays(Number(year)).find((h) => h.name === "Påskedag");
    assert.equal(found?.date, date, `Easter ${year}`);
  }
});

test("2026 holidays match the official Danish calendar", () => {
  const byName = Object.fromEntries(danishHolidays(2026).map((h) => [h.name, h.date]));
  assert.equal(byName["Skærtorsdag"], "2026-04-02");
  assert.equal(byName["Langfredag"], "2026-04-03");
  assert.equal(byName["2. påskedag"], "2026-04-06");
  assert.equal(byName["Kristi himmelfartsdag"], "2026-05-14");
  assert.equal(byName["Pinsedag"], "2026-05-24");
  assert.equal(byName["2. pinsedag"], "2026-05-25");
  assert.equal(Object.keys(byName).length, 10);
});

test("Store Bededag exists up to 2023 and is gone from 2024", () => {
  assert.equal(danishHolidays(2023).find((h) => h.name === "Store bededag")?.date, "2023-05-05");
  assert.equal(danishHolidays(2024).some((h) => h.name === "Store bededag"), false);
  assert.equal(danishHolidays(2022).length, 11);
});

test("holidays come back sorted", () => {
  const dates = danishHolidays(2027).map((h) => h.date);
  assert.deepEqual(dates, [...dates].sort());
});

test("projectYears spans start to end and is capped", () => {
  assert.deepEqual(projectYears("2026-06-22", "2028-02-01"), [2026, 2027, 2028]);
  assert.deepEqual(projectYears("2026-06-22", null), [2026]);
  assert.equal(projectYears("2026-01-01", "9999-12-31").length, 51);
});
