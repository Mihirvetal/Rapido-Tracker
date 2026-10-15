export interface ExpenseCategory {
  id: string;
  name: string;
  userId: string | null;
  isShared: boolean;
}

export interface EntryExpenseInput {
  categoryId: string;
  amount: string;
  description: string;
}

export interface EntryExpenseRecord {
  id: string;
  categoryId: string;
  categoryName: string;
  amount: string;
  description: string | null;
}

export interface DailyEntryRecord {
  id: string;
  entryDate: string;
  totalEarnings: string;
  totalKm: string;
  notes: string | null;
  expenses: EntryExpenseRecord[];
}

export interface DailyEntryListItem {
  id: string;
  entryDate: string;
  totalEarnings: string;
  totalKm: string;
  totalExpenses: string;
  netProfit: string;
}

export type EntryFieldErrors = Partial<{
  entryDate: string;
  totalEarnings: string;
  totalKm: string;
  petrol: string;
  notes: string;
  expenses: string;
  form: string;
}>;

export type SaveEntryResult =
  | { status: "success"; entryId: string; message: string }
  | {
      status: "error";
      message: string;
      fieldErrors?: EntryFieldErrors;
      existingEntryId?: string;
    }
  | {
      status: "duplicate";
      message: string;
      existingEntryId: string;
    };

export type DeleteEntryResult =
  | { status: "success"; message: string }
  | { status: "error"; message: string };
