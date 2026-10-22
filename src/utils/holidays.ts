import { dayNumber, dayToStr } from "./scheduler.ts";

export interface NamedDate {
  date: string; // "YYYY-MM-DD"
  name: string;
}

/** Easter Sunday for a Gregorian year as a day number (anonymous Gregorian algorithm). */
function easterDay(year: number): number {
  const g = year % 19;
  const c = Math.floor(year / 100);
  const h = (c - Math.floor(c / 4) - Math.floor((8 * c + 13) / 25) + 19 * g + 15) % 30;
  const i = h - Math.floor(h / 28) * (1 - Math.floor(h / 28) * Math.floor(29 / (h + 1)) * Math.floor((21 - g) / 11));
  const j = (year + Math.floor(year / 4) + i + 2 - c + Math.floor(c / 4)) % 7;
  const l = i - j;
  const month = 3 + Math.floor((l + 40) / 44);
  const day = l + 28 - 31 * Math.floor(month / 4);
  return Math.floor(Date.UTC(year, month - 1, day) / 86_400_000);
}

/**
 * Official Danish public holidays for a year, sorted by date.
 * Store Bededag was abolished from 2024 and is only included before that.
 */
export function danishHolidays(year: number): NamedDate[] {
  const easter = easterDay(year);
  const at = (offset: number) => dayToStr(easter + offset);

  const list: NamedDate[] = [
    { date: `${year}-01-01`, name: "Nytårsdag" },
    { date: at(-3), name: "Skærtorsdag" },
    { date: at(-2), name: "Langfredag" },
    { date: at(0), name: "Påskedag" },
    { date: at(1), name: "2. påskedag" },
    { date: at(39), name: "Kristi himmelfartsdag" },
    { date: at(49), name: "Pinsedag" },
    { date: at(50), name: "2. pinsedag" },
    { date: `${year}-12-25`, name: "Juledag" },
    { date: `${year}-12-26`, name: "2. juledag" },
  ];
  if (year < 2024) list.push({ date: at(26), name: "Store bededag" });

  return list.sort((a, b) => a.date.localeCompare(b.date));
}

/** The calendar years (start year through end year) a project touches, capped to stay sane. */
export function projectYears(startDate: string, endDate: string | null, maxSpan = 50): number[] {
  const startYear = dayNumber(startDate) !== null ? Number(startDate.slice(0, 4)) : new Date().getFullYear();
  const endYear = endDate && dayNumber(endDate) !== null ? Number(endDate.slice(0, 4)) : startYear;
  const last = Math.min(Math.max(endYear, startYear), startYear + maxSpan);
  const years: number[] = [];
  for (let y = startYear; y <= last; y++) years.push(y);
  return years;
}
