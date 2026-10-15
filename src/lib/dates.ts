/** Today's calendar date (YYYY-MM-DD) in Asia/Kolkata. */
export function todayInKolkata(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function isValidIsoDate(value: string): boolean {
  if (!DATE_PATTERN.test(value)) {
    return false;
  }
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

/**
 * Shift a YYYY-MM-DD calendar date by whole days using UTC date parts.
 * Avoids local-DST / "subtract 24h" bugs near midnight.
 */
export function addCalendarDays(isoDate: string, deltaDays: number): string {
  if (!isValidIsoDate(isoDate)) {
    throw new Error(`Invalid ISO date: ${isoDate}`);
  }
  const [year, month, day] = isoDate.split("-").map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day));
  utc.setUTCDate(utc.getUTCDate() + deltaDays);
  const y = utc.getUTCFullYear();
  const m = String(utc.getUTCMonth() + 1).padStart(2, "0");
  const d = String(utc.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Inclusive calendar window ending on `endDate` with `dayCount` days (e.g. 10 → today and previous 9). */
export function inclusiveDateWindow(
  endDate: string,
  dayCount: number,
): { startDate: string; endDate: string; dayCount: number } {
  if (dayCount < 1) {
    throw new Error("dayCount must be at least 1");
  }
  return {
    startDate: addCalendarDays(endDate, -(dayCount - 1)),
    endDate,
    dayCount,
  };
}

export function isDateInInclusiveRange(
  date: string,
  startDate: string,
  endDate: string,
): boolean {
  return date >= startDate && date <= endDate;
}

const MONTH_PATTERN = /^(\d{4})-(0[1-9]|1[0-2])$/;

/** Strict YYYY-MM validation (rejects 2026-13, etc.). */
export function parseYearMonth(
  value: string | null | undefined,
): { year: number; month: number; id: string } | null {
  if (!value) {
    return null;
  }
  const match = MONTH_PATTERN.exec(value.trim());
  if (!match) {
    return null;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  return {
    year,
    month,
    id: `${match[1]}-${match[2]}`,
  };
}

export function formatYearMonthLabel(year: number, month: number): string {
  const date = new Date(Date.UTC(year, month - 1, 1));
  return date.toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** First and last calendar dates of a month (YYYY-MM-DD). */
export function monthDateBounds(
  year: number,
  month: number,
): { startDate: string; endDate: string; daysInMonth: number } {
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const endDate = `${year}-${String(month).padStart(2, "0")}-${String(daysInMonth).padStart(2, "0")}`;
  return { startDate, endDate, daysInMonth };
}

/** Sunday-based weekday for the 1st of the month (0 = Sunday). */
export function monthStartWeekday(year: number, month: number): number {
  return new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
}

/** Distinct YYYY-MM keys from ISO dates, newest first. */
export function distinctYearMonthsDescending(isoDates: string[]): string[] {
  const set = new Set<string>();
  for (const date of isoDates) {
    if (!isValidIsoDate(date)) {
      continue;
    }
    set.add(date.slice(0, 7));
  }
  return [...set].sort((a, b) => (a < b ? 1 : a > b ? -1 : 0));
}
