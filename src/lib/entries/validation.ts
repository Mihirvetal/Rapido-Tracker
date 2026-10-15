import { isValidIsoDate } from "@/lib/dates";
import { SHARED_PETROL_CATEGORY_ID, UUID_PATTERN } from "@/lib/entries/constants";
import {
  netProfitPaise,
  parseKmInput,
  parseMoneyInput,
  paiseToNumericString,
  sumPaise,
  ZERO_PAISE,
} from "@/lib/money";
import type {
  EntryExpenseInput,
  EntryFieldErrors,
  SaveEntryResult,
} from "@/types/entries";

export interface ValidatedEntryPayload {
  entryDate: string;
  totalEarnings: string;
  totalKm: string;
  notes: string | null;
  expenses: Array<{
    category_id: string;
    amount: string;
    description: string | null;
  }>;
  expenseTotalPaise: bigint;
  netProfitPaise: bigint;
}

export function validateEntryInput(input: {
  entryId?: string | null;
  entryDate: string;
  totalEarnings: string;
  totalKm: string;
  petrolAmount: string;
  notes: string;
  expenses: EntryExpenseInput[];
  allowedCategoryIds: Set<string>;
}):
  | { ok: true; data: ValidatedEntryPayload }
  | { ok: false; fieldErrors: EntryFieldErrors; message: string } {
  const fieldErrors: EntryFieldErrors = {};

  const entryDate = input.entryDate.trim();
  if (!isValidIsoDate(entryDate)) {
    fieldErrors.entryDate = "Enter a valid date.";
  }

  const earnings = parseMoneyInput(input.totalEarnings, "Earnings");
  if (!earnings.ok) {
    fieldErrors.totalEarnings = earnings.error;
  }

  const km = parseKmInput(input.totalKm);
  if (!km.ok) {
    fieldErrors.totalKm = km.error;
  }

  const petrol = parseMoneyInput(input.petrolAmount, "Petrol");
  if (!petrol.ok) {
    fieldErrors.petrol = petrol.error;
  }

  if (input.notes.length > 2000) {
    fieldErrors.notes = "Notes must be 2000 characters or fewer.";
  }

  const expenseRows: ValidatedEntryPayload["expenses"] = [];
  const expensePaiseList: bigint[] = [];

  if (petrol.ok && petrol.paise > ZERO_PAISE) {
    if (!input.allowedCategoryIds.has(SHARED_PETROL_CATEGORY_ID)) {
      fieldErrors.petrol = "Petrol category is unavailable.";
    } else {
      expenseRows.push({
        category_id: SHARED_PETROL_CATEGORY_ID,
        amount: paiseToNumericString(petrol.paise),
        description: null,
      });
      expensePaiseList.push(petrol.paise);
    }
  }

  input.expenses.forEach((row, index) => {
    const amountRaw = row.amount.trim();
    const categoryId = row.categoryId.trim();
    const description = row.description.trim();

    const isEmpty =
      amountRaw === "" && categoryId === "" && description === "";
    if (isEmpty) {
      return;
    }

    if (!UUID_PATTERN.test(categoryId)) {
      fieldErrors.expenses = `Expense row ${index + 1}: choose a category.`;
      return;
    }

    if (!input.allowedCategoryIds.has(categoryId)) {
      fieldErrors.expenses = `Expense row ${index + 1}: invalid category.`;
      return;
    }

    if (categoryId === SHARED_PETROL_CATEGORY_ID) {
      fieldErrors.expenses =
        "Use the Petrol field for petrol. Choose another category for additional expenses.";
      return;
    }

    const amount = parseMoneyInput(amountRaw, `Expense row ${index + 1}`);
    if (!amount.ok) {
      fieldErrors.expenses = amount.error;
      return;
    }

    if (amount.paise === ZERO_PAISE) {
      fieldErrors.expenses = `Expense row ${index + 1}: amount must be greater than zero.`;
      return;
    }

    if (description.length > 500) {
      fieldErrors.expenses = `Expense row ${index + 1}: description is too long.`;
      return;
    }

    expenseRows.push({
      category_id: categoryId,
      amount: paiseToNumericString(amount.paise),
      description: description.length > 0 ? description : null,
    });
    expensePaiseList.push(amount.paise);
  });

  if (Object.keys(fieldErrors).length > 0) {
    return {
      ok: false,
      fieldErrors,
      message: "Please fix the highlighted fields.",
    };
  }

  if (!earnings.ok || !km.ok) {
    return {
      ok: false,
      fieldErrors: { form: "Invalid amounts." },
      message: "Please fix the highlighted fields.",
    };
  }

  const expenseTotalPaise = sumPaise(expensePaiseList);

  return {
    ok: true,
    data: {
      entryDate,
      totalEarnings: paiseToNumericString(earnings.paise),
      totalKm: paiseToNumericString(km.paise),
      notes: input.notes.trim() || null,
      expenses: expenseRows,
      expenseTotalPaise,
      netProfitPaise: netProfitPaise(earnings.paise, expenseTotalPaise),
    },
  };
}

export function mapRpcSaveResult(
  payload: unknown,
): SaveEntryResult {
  if (!payload || typeof payload !== "object") {
    return { status: "error", message: "Unable to save entry." };
  }

  const data = payload as Record<string, unknown>;
  if (data.ok === true && typeof data.entry_id === "string") {
    return {
      status: "success",
      entryId: data.entry_id,
      message: "Entry saved.",
    };
  }

  if (data.code === "duplicate_date" && typeof data.existing_entry_id === "string") {
    return {
      status: "duplicate",
      message:
        typeof data.message === "string"
          ? data.message
          : "An entry already exists for this date.",
      existingEntryId: data.existing_entry_id,
    };
  }

  return {
    status: "error",
    message:
      typeof data.message === "string"
        ? data.message
        : "Unable to save entry.",
  };
}
