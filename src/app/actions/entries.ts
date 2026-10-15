"use server";

import { revalidatePath } from "next/cache";
import {
  fetchExpenseCategories,
} from "@/lib/entries/queries";
import {
  mapRpcSaveResult,
  validateEntryInput,
} from "@/lib/entries/validation";
import { createClient } from "@/lib/supabase/server";
import type {
  DeleteEntryResult,
  EntryExpenseInput,
  SaveEntryResult,
} from "@/types/entries";

export async function saveDailyEntryAction(input: {
  entryId?: string | null;
  entryDate: string;
  totalEarnings: string;
  totalKm: string;
  petrolAmount: string;
  notes: string;
  expenses: EntryExpenseInput[];
}): Promise<SaveEntryResult> {
  const supabase = await createClient();
  const { data: claimsData, error: claimsError } =
    await supabase.auth.getClaims();

  if (claimsError || !claimsData?.claims?.sub) {
    return { status: "error", message: "You must be signed in to save an entry." };
  }

  const categories = await fetchExpenseCategories(supabase);
  const allowedCategoryIds = new Set(categories.map((category) => category.id));

  const validated = validateEntryInput({
    ...input,
    allowedCategoryIds,
  });

  if (!validated.ok) {
    return {
      status: "error",
      message: validated.message,
      fieldErrors: validated.fieldErrors,
    };
  }

  const { data, error } = await supabase.rpc("save_daily_entry", {
    p_entry_date: validated.data.entryDate,
    p_total_earnings: validated.data.totalEarnings,
    p_total_km: validated.data.totalKm,
    p_notes: validated.data.notes,
    p_expenses: validated.data.expenses,
    p_entry_id: input.entryId ?? null,
  });

  if (error) {
    return {
      status: "error",
      message: "Unable to save entry. Please try again.",
    };
  }

  const result = mapRpcSaveResult(data);
  if (result.status === "success") {
    revalidatePath("/entries");
    revalidatePath("/entries/new");
    revalidatePath(`/entries/${result.entryId}`);
    revalidatePath("/");
    revalidatePath("/reports");
  }

  return result;
}

export async function deleteDailyEntryAction(
  entryId: string,
): Promise<DeleteEntryResult> {
  const supabase = await createClient();
  const { data: claimsData, error: claimsError } =
    await supabase.auth.getClaims();

  if (claimsError || !claimsData?.claims?.sub) {
    return { status: "error", message: "You must be signed in." };
  }

  if (!entryId) {
    return { status: "error", message: "Entry id is required." };
  }

  const { data, error } = await supabase.rpc("delete_daily_entry", {
    p_entry_id: entryId,
  });

  if (error) {
    return { status: "error", message: "Unable to delete entry." };
  }

  const payload = data as { ok?: boolean; message?: string } | null;
  if (!payload?.ok) {
    return {
      status: "error",
      message: payload?.message ?? "Unable to delete entry.",
    };
  }

  revalidatePath("/entries");
  revalidatePath(`/entries/${entryId}`);
  revalidatePath("/");
  revalidatePath("/reports");
  return { status: "success", message: "Entry deleted." };
}

export async function createExpenseCategoryAction(
  name: string,
): Promise<{ status: "success"; id: string } | { status: "error"; message: string }> {
  const trimmed = name.trim();
  if (trimmed.length === 0) {
    return { status: "error", message: "Category name is required." };
  }
  if (trimmed.length > 60) {
    return { status: "error", message: "Category name is too long." };
  }

  const supabase = await createClient();
  const { data: claimsData, error: claimsError } =
    await supabase.auth.getClaims();

  if (claimsError || !claimsData?.claims?.sub) {
    return { status: "error", message: "You must be signed in." };
  }

  const userId = claimsData.claims.sub;

  const { data, error } = await supabase
    .from("expense_categories")
    .insert({
      user_id: userId,
      name: trimmed,
      is_active: true,
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      return {
        status: "error",
        message: "You already have a category with that name.",
      };
    }
    return { status: "error", message: "Unable to create category." };
  }

  revalidatePath("/entries/new");
  return { status: "success", id: data.id as string };
}
