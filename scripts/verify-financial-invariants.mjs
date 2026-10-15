import assert from "node:assert/strict";

const ZERO = 0n;
const HUNDRED = 100n;

function parseMoney(raw) {
  const trimmed = String(raw).trim();
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(trimmed)) {
    throw new Error(`bad money: ${raw}`);
  }
  const [w, f = ""] = trimmed.split(".");
  return BigInt(w) * HUNDRED + BigInt((f + "00").slice(0, 2));
}

function sum(values) {
  return values.reduce((a, b) => a + b, ZERO);
}

function net(earnings, expenses) {
  return earnings - expenses;
}

function inclusiveWindow(end, dayCount) {
  const [y, m, d] = end.split("-").map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d));
  utc.setUTCDate(utc.getUTCDate() - (dayCount - 1));
  const start = `${utc.getUTCFullYear()}-${String(utc.getUTCMonth() + 1).padStart(2, "0")}-${String(utc.getUTCDate()).padStart(2, "0")}`;
  return { start, end };
}

function inRange(date, start, end) {
  return date >= start && date <= end;
}

// Deterministic fixture (paise)
const entries = [
  {
    date: "2026-10-15",
    earnings: parseMoney("1000.00"),
    expenses: [parseMoney("200.00") /* petrol */, parseMoney("50.50") /* food */],
  },
  {
    date: "2026-10-10",
    earnings: parseMoney("500"),
    expenses: [parseMoney("100")],
  },
  {
    date: "2026-09-01",
    earnings: parseMoney("0"), // explicit zero-earning day
    expenses: [parseMoney("40")],
  },
];

// Petrol counted once in first entry
assert.equal(entries[0].expenses.length, 2);
const entry0Expense = sum(entries[0].expenses);
assert.equal(entry0Expense, 25050n);
assert.equal(net(entries[0].earnings, entry0Expense), 74950n);

const today = "2026-10-15";
const last10 = inclusiveWindow(today, 10);
const last30 = inclusiveWindow(today, 30);
assert.equal(last10.start, "2026-10-06");
assert.equal(last30.start, "2026-09-16");

function sumEarnings(window) {
  return sum(
    entries
      .filter((e) => inRange(e.date, window.start, window.end))
      .map((e) => e.earnings),
  );
}

assert.equal(sumEarnings({ start: today, end: today }), 100000n);
assert.equal(sumEarnings(last10), 150000n); // Oct 15 + Oct 10
assert.equal(sumEarnings(last30), 150000n); // Oct 15 + Oct 10; Sep 1 before Sep 16
assert.equal(inRange("2026-09-01", last30.start, last30.end), false);

const allEarnings = sum(entries.map((e) => e.earnings));
const allExpenses = sum(entries.flatMap((e) => e.expenses));
assert.equal(allEarnings, 150000n);
assert.equal(allExpenses, 39050n);
assert.equal(net(allEarnings, allExpenses), 110950n);

// Missing calendar day is not an entry and not zero earnings
const hasOct14 = entries.some((e) => e.date === "2026-10-14");
assert.equal(hasOct14, false);

// Dashboard (window earnings) vs reports (month) agreement on shared Oct records
const octEntries = entries.filter((e) => e.date.startsWith("2026-10"));
const octEarnings = sum(octEntries.map((e) => e.earnings));
const octExpenses = sum(octEntries.flatMap((e) => e.expenses));
assert.equal(octEarnings, 150000n);
assert.equal(octExpenses, 35050n);
assert.equal(net(octEarnings, octExpenses), 114950n);

// Rounding: 0.10 + 0.20 exact in paise
assert.equal(parseMoney("0.10") + parseMoney("0.20"), 30n);

console.log("verify-financial-invariants: ok");
