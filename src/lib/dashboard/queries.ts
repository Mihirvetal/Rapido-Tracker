import type { SupabaseClient } from "@supabase/supabase-js";
import {
  inclusiveDateWindow,
  isDateInInclusiveRange,
  todayInKolkata,
} from "@/lib/dates";
import { fetchEntryHistory } from "@/lib/entries/queries";
import {
  formatPaise,
  netProfitPaise,
  parseMoneyInput,
  sumPaise,
  ZERO_PAISE,
} from "@/lib/money";
import type { DailyEntryListItem } from "@/types/entries";

export type DashboardMetricTone = "profit" | "expense";

export interface DashboardMetric {
  id: "today" | "last10" | "last30" | "overall";
  label: string;
  valueLabel: string;
  hint: string;
  tone: DashboardMetricTone;
}

export type DashboardDataResult =
  | {
      ok: true;
      today: string;
      metrics: DashboardMetric[];
      recentEntries: DailyEntryListItem[];
      hasAnyEntries: boolean;
    }
  | {
      ok: false;
      message: string;
    };

function sumEarningsInRange(
  rows: Array<{ entry_date: string; total_earnings: string | number }>,
  startDate: string,
  endDate: string,
): bigint {
  const values: bigint[] = [];
  for (const row of rows) {
    if (!isDateInInclusiveRange(row.entry_date, startDate, endDate)) {
      continue;
    }
    const parsed = parseMoneyInput(String(row.total_earnings));
    if (!parsed.ok) {
      throw new Error("Invalid earnings amount in database.");
    }
    values.push(parsed.paise);
  }
  return sumPaise(values);
}

function sumAmountColumn(
  rows: Array<{ amount?: string | number; total_earnings?: string | number }>,
  field: "amount" | "total_earnings",
): bigint {
  const values: bigint[] = [];
  for (const row of rows) {
    const raw = field === "amount" ? row.amount : row.total_earnings;
    const parsed = parseMoneyInput(String(raw ?? "0"));
    if (!parsed.ok) {
      throw new Error("Invalid monetary amount in database.");
    }
    values.push(parsed.paise);
  }
  return sumPaise(values);
}

/**
 * Load dashboard metrics and recent entries for the authenticated user (via RLS).
 * Errors are returned explicitly — never masked as zeros.
 */
export async function fetchDashboardData(
  supabase: SupabaseClient,
): Promise<DashboardDataResult> {
  const today = todayInKolkata();
  const last10 = inclusiveDateWindow(today, 10);
  const last30 = inclusiveDateWindow(today, 30);

  const [rangeResult, allEarningsResult, allExpensesResult, recentResult] =
    await Promise.all([
      supabase
        .from("daily_entries")
        .select("entry_date, total_earnings")
        .gte("entry_date", last30.startDate)
        .lte("entry_date", last30.endDate),
      supabase.from("daily_entries").select("total_earnings"),
      supabase.from("daily_expenses").select("amount"),
      fetchEntryHistory(supabase, 5),
    ]);

  if (rangeResult.error) {
    return {
      ok: false,
      message: "Could not load period earnings. Please try again.",
    };
  }
  if (allEarningsResult.error) {
    return {
      ok: false,
      message: "Could not load overall earnings. Please try again.",
    };
  }
  if (allExpensesResult.error) {
    return {
      ok: false,
      message: "Could not load overall expenses. Please try again.",
    };
  }
  if (!recentResult.ok) {
    return {
      ok: false,
      message: recentResult.message,
    };
  }

  try {
    const rangeRows = (rangeResult.data ?? []) as Array<{
      entry_date: string;
      total_earnings: string | number;
    }>;

    const todayEarnings = sumEarningsInRange(rangeRows, today, today);
    const last10Earnings = sumEarningsInRange(
      rangeRows,
      last10.startDate,
      last10.endDate,
    );
    const last30Earnings = sumEarningsInRange(
      rangeRows,
      last30.startDate,
      last30.endDate,
    );

    const allEarnings = sumAmountColumn(
      (allEarningsResult.data ?? []) as Array<{ total_earnings: string | number }>,
      "total_earnings",
    );
    const allExpenses = sumAmountColumn(
      (allExpensesResult.data ?? []) as Array<{ amount: string | number }>,
      "amount",
    );
    const overallProfit = netProfitPaise(allEarnings, allExpenses);

    const hasAnyEntries = (allEarningsResult.data ?? []).length > 0;

    const metrics: DashboardMetric[] = [
      {
        id: "today",
        label: "Today's Earnings",
        valueLabel: formatPaise(todayEarnings),
        hint: `Entry date ${today} (Asia/Kolkata)`,
        tone: "profit",
      },
      {
        id: "last10",
        label: "Last 10 Days",
        valueLabel: formatPaise(last10Earnings),
        hint: `${last10.startDate} → ${last10.endDate}`,
        tone: "profit",
      },
      {
        id: "last30",
        label: "Last 30 Days",
        valueLabel: formatPaise(last30Earnings),
        hint: `${last30.startDate} → ${last30.endDate}`,
        tone: "profit",
      },
      {
        id: "overall",
        label: "Overall Net Profit",
        valueLabel: formatPaise(overallProfit),
        hint: "All-time earnings − all recorded expenses",
        tone: overallProfit < ZERO_PAISE ? "expense" : "profit",
      },
    ];

    return {
      ok: true,
      today,
      metrics,
      recentEntries: recentResult.entries,
      hasAnyEntries,
    };
  } catch {
    return {
      ok: false,
      message: "Could not calculate dashboard totals. Please try again.",
    };
  }
}
