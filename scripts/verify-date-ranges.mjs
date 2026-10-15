import assert from "node:assert/strict";

function isValidIsoDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function addCalendarDays(isoDate, deltaDays) {
  const [year, month, day] = isoDate.split("-").map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day));
  utc.setUTCDate(utc.getUTCDate() + deltaDays);
  const y = utc.getUTCFullYear();
  const m = String(utc.getUTCMonth() + 1).padStart(2, "0");
  const d = String(utc.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function inclusiveDateWindow(endDate, dayCount) {
  return {
    startDate: addCalendarDays(endDate, -(dayCount - 1)),
    endDate,
    dayCount,
  };
}

assert.equal(isValidIsoDate("2026-10-15"), true);
assert.equal(addCalendarDays("2026-10-15", -9), "2026-10-06");
assert.equal(addCalendarDays("2026-03-01", -1), "2026-02-28");

const ten = inclusiveDateWindow("2026-10-15", 10);
assert.equal(ten.startDate, "2026-10-06");
assert.equal(ten.endDate, "2026-10-15");

const thirty = inclusiveDateWindow("2026-10-15", 30);
assert.equal(thirty.startDate, "2026-09-16");
assert.equal(thirty.endDate, "2026-10-15");

// Count inclusive calendar days
function countDays(start, end) {
  let n = 0;
  let cursor = start;
  while (cursor <= end) {
    n += 1;
    cursor = addCalendarDays(cursor, 1);
  }
  return n;
}

assert.equal(countDays(ten.startDate, ten.endDate), 10);
assert.equal(countDays(thirty.startDate, thirty.endDate), 30);

// Month helpers
const MONTH_PATTERN = /^(\d{4})-(0[1-9]|1[0-2])$/;
function parseYearMonth(value) {
  const match = MONTH_PATTERN.exec(String(value ?? "").trim());
  if (!match) return null;
  return { year: Number(match[1]), month: Number(match[2]), id: `${match[1]}-${match[2]}` };
}
function monthDateBounds(year, month) {
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const endDate = `${year}-${String(month).padStart(2, "0")}-${String(daysInMonth).padStart(2, "0")}`;
  return { startDate, endDate, daysInMonth };
}
function monthStartWeekday(year, month) {
  return new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
}
function distinctYearMonthsDescending(isoDates) {
  const set = new Set();
  for (const date of isoDates) {
    if (isValidIsoDate(date)) set.add(date.slice(0, 7));
  }
  return [...set].sort((a, b) => (a < b ? 1 : a > b ? -1 : 0));
}

assert.equal(parseYearMonth("2026-10")?.id, "2026-10");
assert.equal(parseYearMonth("2026-13"), null);
assert.equal(parseYearMonth("2026-1"), null);
assert.deepEqual(monthDateBounds(2026, 10), {
  startDate: "2026-10-01",
  endDate: "2026-10-31",
  daysInMonth: 31,
});
assert.deepEqual(monthDateBounds(2024, 2), {
  startDate: "2024-02-01",
  endDate: "2024-02-29",
  daysInMonth: 29,
});
assert.equal(monthStartWeekday(2026, 10), 4); // Thursday
assert.deepEqual(
  distinctYearMonthsDescending(["2026-10-14", "2026-09-01", "2026-10-01"]),
  ["2026-10", "2026-09"],
);

// Year boundary
assert.equal(addCalendarDays("2026-01-01", -1), "2025-12-31");
const yearEdge = inclusiveDateWindow("2026-01-05", 10);
assert.equal(yearEdge.startDate, "2025-12-27");
assert.equal(countDays(yearEdge.startDate, yearEdge.endDate), 10);

// Leap year
assert.equal(isValidIsoDate("2024-02-29"), true);
assert.equal(isValidIsoDate("2025-02-29"), false);
assert.equal(addCalendarDays("2024-02-28", 1), "2024-02-29");
assert.equal(addCalendarDays("2024-02-29", 1), "2024-03-01");
assert.deepEqual(monthDateBounds(2025, 2), {
  startDate: "2025-02-01",
  endDate: "2025-02-28",
  daysInMonth: 28,
});

// Invalid dates / months
assert.equal(isValidIsoDate("2026-13-01"), false);
assert.equal(isValidIsoDate("2026-00-10"), false);
assert.equal(isValidIsoDate("2026-02-30"), false);
assert.equal(parseYearMonth("2026-00"), null);
assert.equal(parseYearMonth("2026-13"), null);
assert.equal(parseYearMonth(""), null);
assert.equal(parseYearMonth(null), null);

console.log("verify-date-ranges: ok");
