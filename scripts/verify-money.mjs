import assert from "node:assert/strict";

const MONEY_PATTERN = /^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/;
const ZERO = 0n;
const HUNDRED = 100n;

function parseMoneyInput(raw, fieldLabel = "Amount") {
  const trimmed = raw.trim();
  if (trimmed === "") return { ok: true, paise: ZERO };
  if (!MONEY_PATTERN.test(trimmed)) {
    return { ok: false, error: `${fieldLabel} invalid` };
  }
  const [whole, fraction = ""] = trimmed.split(".");
  const paise = BigInt(whole) * HUNDRED + BigInt((fraction + "00").slice(0, 2));
  return { ok: true, paise };
}

function sumPaise(values) {
  return values.reduce((total, value) => total + value, ZERO);
}

function netProfitPaise(earnings, expenses) {
  return earnings - expenses;
}

function paiseToNumericString(paise) {
  const negative = paise < ZERO;
  const abs = negative ? -paise : paise;
  const whole = abs / HUNDRED;
  const fraction = (abs % HUNDRED).toString().padStart(2, "0");
  return `${negative ? "-" : ""}${whole.toString()}.${fraction}`;
}

// Reject negatives
assert.equal(parseMoneyInput("-10").ok, false);
assert.equal(parseMoneyInput("-0.01").ok, false);

// Decimal exactness
assert.equal(parseMoneyInput("10.10").paise, 1010n);
assert.equal(parseMoneyInput("0.1").paise, 10n);
assert.equal(paiseToNumericString(1010n), "10.10");

// Multiple expenses + petrol once
const earnings = parseMoneyInput("500").paise;
const petrol = parseMoneyInput("40").paise;
const food = parseMoneyInput("30.50").paise;
const toll = parseMoneyInput("20").paise;
const expenses = sumPaise([petrol, food, toll]);
assert.equal(expenses, 9050n);
assert.equal(netProfitPaise(earnings, expenses), 40950n);
assert.equal(paiseToNumericString(netProfitPaise(earnings, expenses)), "409.50");

// Petrol counted once in aggregation (not duplicated in "other")
const expenseRows = [
  { category: "petrol", amount: "40" },
  { category: "food", amount: "30.50" },
];
const petrolOnly = expenseRows
  .filter((row) => row.category === "petrol")
  .map((row) => parseMoneyInput(row.amount).paise);
const otherOnly = expenseRows
  .filter((row) => row.category !== "petrol")
  .map((row) => parseMoneyInput(row.amount).paise);
assert.equal(sumPaise([...petrolOnly, ...otherOnly]), 7050n);
assert.equal(petrolOnly.length, 1);

// Missing entry ≠ zero earning contribution
const rangeRows = [{ entry_date: "2026-10-15", total_earnings: "100" }];
function sumEarningsInRange(rows, startDate, endDate) {
  const values = [];
  for (const row of rows) {
    if (row.entry_date < startDate || row.entry_date > endDate) continue;
    values.push(parseMoneyInput(String(row.total_earnings)).paise);
  }
  return sumPaise(values);
}
assert.equal(sumEarningsInRange(rangeRows, "2026-10-14", "2026-10-15"), 10000n);
assert.equal(sumEarningsInRange(rangeRows, "2026-10-14", "2026-10-14"), 0n);

console.log("verify-money: ok");
