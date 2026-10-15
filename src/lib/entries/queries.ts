import type { SupabaseClient } from "@supabase/supabase-js";
import { SHARED_PETROL_CATEGORY_ID } from "@/lib/entries/constants";
import {
  formatInrExact,
  netProfitPaise,
  parseMoneyInput,
  paiseToNumericString,
  sumPaise,
  ZERO_PAISE,
} from "@/lib/money";
import type {
  DailyEntryListItem,
  DailyEntryRecord,
  ExpenseCategory,
} from "@/types/entries";

export async function fetchExpenseCategories(
  supabase: SupabaseClient,
): Promise<ExpenseCategory[]> {
  const { data, error } = await supabase
    .from("expense_categories")
    .select("id, name, user_id, is_active")
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (error || !data) {
    return [];
  }

  return data.map((row) => ({
    id: row.id as string,
    name: row.name as string,
    userId: (row.user_id as string | null) ?? null,
    isShared: row.user_id == null,
  }));
}

export async function fetchDailyEntry(
  supabase: SupabaseClient,
  entryId: string,
): Promise<DailyEntryRecord | null> {
  const { data: entry, error } = await supabase
    .from("daily_entries")
    .select("id, entry_date, total_earnings, total_km, notes")
    .eq("id", entryId)
    .maybeSingle();

  if (error || !entry) {
    return null;
  }

  const { data: expenses } = await supabase
    .from("daily_expenses")
    .select("id, category_id, amount, description")
    .eq("daily_entry_id", entryId)
    .order("created_at", { ascending: true });

  const categoryIds = [
    ...new Set((expenses ?? []).map((row) => row.category_id as string)),
  ];

  const categoryNames = new Map<string, string>();
  if (categoryIds.length > 0) {
    const { data: categories } = await supabase
      .from("expense_categories")
      .select("id, name")
      .in("id", categoryIds);

    for (const category of categories ?? []) {
      categoryNames.set(category.id as string, category.name as string);
    }
  }

  return {
    id: entry.id as string,
    entryDate: entry.entry_date as string,
    totalEarnings: String(entry.total_earnings),
    totalKm: String(entry.total_km),
    notes: (entry.notes as string | null) ?? null,
    expenses: (expenses ?? []).map((row) => ({
      id: row.id as string,
      categoryId: row.category_id as string,
      categoryName: categoryNames.get(row.category_id as string) ?? "Unknown",
      amount: String(row.amount),
      description: (row.description as string | null) ?? null,
    })),
  };
}

export type EntryHistoryResult =
  | { ok: true; entries: DailyEntryListItem[] }
  | { ok: false; message: string };

export async function fetchEntryHistory(
  supabase: SupabaseClient,
  limit = 50,
): Promise<EntryHistoryResult> {
  const { data: entries, error } = await supabase
    .from("daily_entries")
    .select("id, entry_date, total_earnings, total_km")
    .order("entry_date", { ascending: false })
    .limit(limit);

  if (error) {
    return {
      ok: false,
      message: "Could not load entry history. Please try again.",
    };
  }

  if (!entries || entries.length === 0) {
    return { ok: true, entries: [] };
  }

  const ids = entries.map((entry) => entry.id as string);

  const { data: expenses, error: expenseError } = await supabase
    .from("daily_expenses")
    .select("daily_entry_id, amount")
    .in("daily_entry_id", ids);

  if (expenseError) {
    return {
      ok: false,
      message: "Could not load entry expenses. Please try again.",
    };
  }

  const totals = new Map<string, bigint>();
  for (const row of expenses ?? []) {
    const entryId = row.daily_entry_id as string;
    const parsed = parseMoneyInput(String(row.amount));
    if (!parsed.ok) {
      return {
        ok: false,
        message: "Could not calculate entry totals. Please try again.",
      };
    }
    totals.set(entryId, (totals.get(entryId) ?? ZERO_PAISE) + parsed.paise);
  }

  const list: DailyEntryListItem[] = [];
  for (const entry of entries) {
    const earningsParsed = parseMoneyInput(String(entry.total_earnings));
    if (!earningsParsed.ok) {
      return {
        ok: false,
        message: "Could not calculate entry totals. Please try again.",
      };
    }
    const expenseTotal = totals.get(entry.id as string) ?? ZERO_PAISE;
    const profit = netProfitPaise(earningsParsed.paise, expenseTotal);

    list.push({
      id: entry.id as string,
      entryDate: entry.entry_date as string,
      totalEarnings: String(entry.total_earnings),
      totalKm: String(entry.total_km),
      totalExpenses: paiseToNumericString(expenseTotal),
      netProfit: paiseToNumericString(profit),
    });
  }

  return { ok: true, entries: list };
}

export function splitPetrolFromExpenses(
  expenses: DailyEntryRecord["expenses"],
): {
  petrolAmount: string;
  otherExpenses: DailyEntryRecord["expenses"];
} {
  let petrolAmount = "0";
  const otherExpenses: DailyEntryRecord["expenses"] = [];

  for (const expense of expenses) {
    if (expense.categoryId === SHARED_PETROL_CATEGORY_ID) {
      const current = parseMoneyInput(petrolAmount);
      const next = parseMoneyInput(expense.amount);
      const total =
        (current.ok ? current.paise : ZERO_PAISE) +
        (next.ok ? next.paise : ZERO_PAISE);
      petrolAmount = paiseToNumericString(total);
    } else {
      otherExpenses.push(expense);
    }
  }

  return { petrolAmount, otherExpenses };
}

export function previewTotals(
  earningsRaw: string,
  petrolRaw: string,
  rows: Array<{ amount: string }>,
): {
  expenses: string;
  profit: string;
  expensesLabel: string;
  profitLabel: string;
} {
  const earnings = parseMoneyInput(earningsRaw);
  const petrol = parseMoneyInput(petrolRaw);
  const rowPaise = rows.map((row) => {
    const parsed = parseMoneyInput(row.amount);
    return parsed.ok ? parsed.paise : ZERO_PAISE;
  });

  const expenseTotal = sumPaise([
    petrol.ok ? petrol.paise : ZERO_PAISE,
    ...rowPaise,
  ]);
  const profit = netProfitPaise(
    earnings.ok ? earnings.paise : ZERO_PAISE,
    expenseTotal,
  );

  return {
    expenses: paiseToNumericString(expenseTotal),
    profit: paiseToNumericString(profit),
    expensesLabel: formatInrExact(paiseToNumericString(expenseTotal)),
    profitLabel: formatInrExact(paiseToNumericString(profit)),
  };
}
