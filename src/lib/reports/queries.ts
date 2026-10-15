import type { SupabaseClient } from "@supabase/supabase-js";
import {
  distinctYearMonthsDescending,
  formatYearMonthLabel,
  monthDateBounds,
  monthStartWeekday,
  parseYearMonth,
} from "@/lib/dates";
import { formatKm } from "@/lib/format";
import {
  formatPaise,
  netProfitPaise,
  parseKmInput,
  parseMoneyInput,
  sumPaise,
  ZERO_PAISE,
} from "@/lib/money";
import type {
  ReportMonthDataResult,
  ReportMonthEntry,
  ReportMonthOption,
  ReportMonthsResult,
  ReportMonthView,
} from "@/types/reports";

function toMonthOption(id: string): ReportMonthOption | null {
  const parsed = parseYearMonth(id);
  if (!parsed) {
    return null;
  }
  return {
    id: parsed.id,
    year: parsed.year,
    month: parsed.month,
    label: formatYearMonthLabel(parsed.year, parsed.month),
  };
}

/** Distinct months that have at least one saved entry (RLS-scoped). */
export async function fetchReportMonths(
  supabase: SupabaseClient,
): Promise<ReportMonthsResult> {
  const { data, error } = await supabase
    .from("daily_entries")
    .select("entry_date")
    .order("entry_date", { ascending: false });

  if (error) {
    return {
      ok: false,
      message: "Could not load report months. Please try again.",
    };
  }

  const monthIds = distinctYearMonthsDescending(
    (data ?? []).map((row) => row.entry_date as string),
  );

  const months = monthIds
    .map((id) => toMonthOption(id))
    .filter((month): month is ReportMonthOption => month != null);

  return { ok: true, months };
}

/**
 * Build one month's summary, calendar, and entry list.
 * Uses separate entry/expense queries to avoid join fan-out.
 */
export async function fetchMonthReport(
  supabase: SupabaseClient,
  monthId: string,
): Promise<ReportMonthDataResult> {
  const parsed = parseYearMonth(monthId);
  if (!parsed) {
    return { ok: false, message: "Invalid month. Use YYYY-MM." };
  }

  const month = toMonthOption(parsed.id);
  if (!month) {
    return { ok: false, message: "Invalid month. Use YYYY-MM." };
  }

  const { startDate, endDate, daysInMonth } = monthDateBounds(
    parsed.year,
    parsed.month,
  );

  const { data: entries, error: entriesError } = await supabase
    .from("daily_entries")
    .select("id, entry_date, total_earnings, total_km")
    .gte("entry_date", startDate)
    .lte("entry_date", endDate)
    .order("entry_date", { ascending: false });

  if (entriesError) {
    return {
      ok: false,
      message: "Could not load monthly entries. Please try again.",
    };
  }

  const entryRows = entries ?? [];
  const ids = entryRows.map((entry) => entry.id as string);

  let expenseRows: Array<{ daily_entry_id: string; amount: string | number }> =
    [];

  if (ids.length > 0) {
    const { data: expenses, error: expenseError } = await supabase
      .from("daily_expenses")
      .select("daily_entry_id, amount")
      .in("daily_entry_id", ids);

    if (expenseError) {
      return {
        ok: false,
        message: "Could not load monthly expenses. Please try again.",
      };
    }
    expenseRows = (expenses ?? []) as Array<{
      daily_entry_id: string;
      amount: string | number;
    }>;
  }

  try {
    const expenseByEntry = new Map<string, bigint>();
    for (const row of expenseRows) {
      const parsedAmount = parseMoneyInput(String(row.amount));
      if (!parsedAmount.ok) {
        return {
          ok: false,
          message: "Could not calculate monthly expenses.",
        };
      }
      const entryId = row.daily_entry_id;
      expenseByEntry.set(
        entryId,
        (expenseByEntry.get(entryId) ?? ZERO_PAISE) + parsedAmount.paise,
      );
    }

    const earningsParts: bigint[] = [];
    const expenseParts: bigint[] = [];
    const kmParts: bigint[] = [];
    const listEntries: ReportMonthEntry[] = [];
    const byDate = new Map<
      string,
      {
        id: string;
        earnings: bigint;
        expenses: bigint;
        km: bigint;
      }
    >();

    for (const entry of entryRows) {
      const earnings = parseMoneyInput(String(entry.total_earnings));
      const km = parseKmInput(String(entry.total_km));
      if (!earnings.ok || !km.ok) {
        return {
          ok: false,
          message: "Could not calculate monthly totals.",
        };
      }

      const expenses = expenseByEntry.get(entry.id as string) ?? ZERO_PAISE;
      const profit = netProfitPaise(earnings.paise, expenses);

      earningsParts.push(earnings.paise);
      expenseParts.push(expenses);
      kmParts.push(km.paise);

      byDate.set(entry.entry_date as string, {
        id: entry.id as string,
        earnings: earnings.paise,
        expenses,
        km: km.paise,
      });

      listEntries.push({
        id: entry.id as string,
        entryDate: entry.entry_date as string,
        earningsLabel: formatPaise(earnings.paise),
        expensesLabel: formatPaise(expenses),
        netProfitLabel: formatPaise(profit),
        kilometresLabel: formatKm(Number(paiseToKmNumber(km.paise))),
        netProfitNegative: profit < ZERO_PAISE,
      });
    }

    const totalEarnings = sumPaise(earningsParts);
    const totalExpenses = sumPaise(expenseParts);
    const totalKm = sumPaise(kmParts);
    const netProfit = netProfitPaise(totalEarnings, totalExpenses);

    const days = Array.from({ length: daysInMonth }, (_, index) => {
      const day = index + 1;
      const date = `${parsed.id}-${String(day).padStart(2, "0")}`;
      const record = byDate.get(date);
      if (!record) {
        return {
          date,
          day,
          hasEntry: false,
          entryId: null,
          expenseLabel: null,
          profitLabel: null,
          zeroEarnings: false,
        };
      }
      const profit = netProfitPaise(record.earnings, record.expenses);
      return {
        date,
        day,
        hasEntry: true,
        entryId: record.id,
        expenseLabel: formatPaise(record.expenses),
        profitLabel: formatPaise(profit),
        zeroEarnings: record.earnings === ZERO_PAISE,
      };
    });

    const report: ReportMonthView = {
      month,
      summary: {
        earningsLabel: formatPaise(totalEarnings),
        expensesLabel: formatPaise(totalExpenses),
        netProfitLabel: formatPaise(netProfit),
        kilometresLabel: formatKm(Number(paiseToKmNumber(totalKm))),
        netProfitNegative: netProfit < ZERO_PAISE,
        entryCount: entryRows.length,
      },
      calendarStartOffset: monthStartWeekday(parsed.year, parsed.month),
      days,
      entries: listEntries,
    };

    return { ok: true, report };
  } catch {
    return {
      ok: false,
      message: "Could not build the monthly report. Please try again.",
    };
  }
}

/** Convert km stored as hundredths (same shape as paise) back to a number for display. */
function paiseToKmNumber(hundredths: bigint): number {
  const negative = hundredths < ZERO_PAISE;
  const abs = negative ? -hundredths : hundredths;
  const whole = abs / BigInt(100);
  const fraction = abs % BigInt(100);
  const value = Number(whole) + Number(fraction) / 100;
  return negative ? -value : value;
}
