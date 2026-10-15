"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useId,
  useMemo,
  useState,
  useTransition,
  type FormEvent,
} from "react";
import {
  createExpenseCategoryAction,
  deleteDailyEntryAction,
  saveDailyEntryAction,
} from "@/app/actions/entries";
import { FormMessage } from "@/components/auth/form-message";
import { SHARED_PETROL_CATEGORY_ID } from "@/lib/entries/constants";
import { previewTotals } from "@/lib/entries/queries";
import type {
  DailyEntryRecord,
  EntryFieldErrors,
  ExpenseCategory,
} from "@/types/entries";

interface ExpenseRowState {
  key: string;
  categoryId: string;
  amount: string;
  description: string;
}

interface DailyEntryFormProps {
  mode: "create" | "edit";
  categories: ExpenseCategory[];
  defaultDate: string;
  initialEntry?: DailyEntryRecord | null;
  initialPetrolAmount?: string;
}

function toOtherRows(
  entry: DailyEntryRecord | null | undefined,
): ExpenseRowState[] {
  const others =
    entry?.expenses.filter(
      (expense) => expense.categoryId !== SHARED_PETROL_CATEGORY_ID,
    ) ?? [];

  if (others.length === 0) {
    return [
      {
        key: "row-1",
        categoryId: "",
        amount: "",
        description: "",
      },
    ];
  }

  return others.map((expense, index) => ({
    key: expense.id || `row-${index}`,
    categoryId: expense.categoryId,
    amount: expense.amount,
    description: expense.description ?? "",
  }));
}

export function DailyEntryForm({
  mode,
  categories,
  defaultDate,
  initialEntry = null,
  initialPetrolAmount = "",
}: DailyEntryFormProps) {
  const formId = useId();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const selectableCategories = useMemo(
    () =>
      categories.filter((category) => category.id !== SHARED_PETROL_CATEGORY_ID),
    [categories],
  );

  const [entryDate, setEntryDate] = useState(
    initialEntry?.entryDate ?? defaultDate,
  );
  const [totalEarnings, setTotalEarnings] = useState(
    initialEntry?.totalEarnings ?? "",
  );
  const [totalKm, setTotalKm] = useState(initialEntry?.totalKm ?? "");
  const [petrolAmount, setPetrolAmount] = useState(initialPetrolAmount);
  const [notes, setNotes] = useState(initialEntry?.notes ?? "");
  const [rows, setRows] = useState<ExpenseRowState[]>(() =>
    toOtherRows(initialEntry),
  );
  const [availableCategories, setAvailableCategories] =
    useState(selectableCategories);
  const [fieldErrors, setFieldErrors] = useState<EntryFieldErrors>({});
  const [formMessage, setFormMessage] = useState<{
    tone: "error" | "success" | "info";
    text: string;
  } | null>(null);
  const [duplicateEntryId, setDuplicateEntryId] = useState<string | null>(null);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const totals = previewTotals(totalEarnings, petrolAmount, rows);

  function updateRow(
    key: string,
    field: keyof Omit<ExpenseRowState, "key">,
    value: string,
  ) {
    setRows((current) =>
      current.map((row) =>
        row.key === key ? { ...row, [field]: value } : row,
      ),
    );
  }

  function addRow() {
    setRows((current) => [
      ...current,
      {
        key: `row-${Date.now()}-${current.length}`,
        categoryId: "",
        amount: "",
        description: "",
      },
    ]);
  }

  function removeRow(key: string) {
    setRows((current) =>
      current.length <= 1
        ? [
            {
              key: "row-1",
              categoryId: "",
              amount: "",
              description: "",
            },
          ]
        : current.filter((row) => row.key !== key),
    );
  }

  function handleCreateCategory() {
    startTransition(async () => {
      const result = await createExpenseCategoryAction(newCategoryName);
      if (result.status === "error") {
        setFormMessage({ tone: "error", text: result.message });
        return;
      }
      const created: ExpenseCategory = {
        id: result.id,
        name: newCategoryName.trim(),
        userId: "self",
        isShared: false,
      };
      setAvailableCategories((current) =>
        [...current, created].sort((a, b) => a.name.localeCompare(b.name)),
      );
      setNewCategoryName("");
      setFormMessage({ tone: "success", text: "Category added." });
    });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) {
      return;
    }

    setFieldErrors({});
    setFormMessage(null);
    setDuplicateEntryId(null);

    startTransition(async () => {
      const result = await saveDailyEntryAction({
        entryId: mode === "edit" ? initialEntry?.id : null,
        entryDate,
        totalEarnings,
        totalKm,
        petrolAmount,
        notes,
        expenses: rows.map((row) => ({
          categoryId: row.categoryId,
          amount: row.amount,
          description: row.description,
        })),
      });

      if (result.status === "duplicate") {
        setDuplicateEntryId(result.existingEntryId);
        setFormMessage({ tone: "info", text: result.message });
        return;
      }

      if (result.status === "error") {
        setFieldErrors(result.fieldErrors ?? {});
        setFormMessage({ tone: "error", text: result.message });
        if (result.existingEntryId) {
          setDuplicateEntryId(result.existingEntryId);
        }
        return;
      }

      setFormMessage({ tone: "success", text: result.message });

      if (mode === "create") {
        setEntryDate(defaultDate);
        setTotalEarnings("");
        setTotalKm("");
        setPetrolAmount("");
        setNotes("");
        setRows([
          {
            key: `row-${Date.now()}`,
            categoryId: "",
            amount: "",
            description: "",
          },
        ]);
        setFieldErrors({});
        setDuplicateEntryId(null);
        setConfirmDelete(false);
        router.refresh();
        return;
      }

      router.replace(`/entries/${result.entryId}`);
      router.refresh();
    });
  }

  function handleDelete() {
    if (!initialEntry || pending) {
      return;
    }
    startTransition(async () => {
      const result = await deleteDailyEntryAction(initialEntry.id);
      if (result.status === "error") {
        setFormMessage({ tone: "error", text: result.message });
        setConfirmDelete(false);
        return;
      }
      router.replace("/entries");
      router.refresh();
    });
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit} noValidate>
      {formMessage ? (
        <FormMessage tone={formMessage.tone}>{formMessage.text}</FormMessage>
      ) : null}

      {duplicateEntryId ? (
        <p className="rounded-lg border border-border bg-surface-muted px-3 py-2 text-sm text-muted">
          Open the existing entry for that date:{" "}
          <Link
            href={`/entries/${duplicateEntryId}`}
            className="font-medium text-accent hover:underline"
          >
            View entry
          </Link>
        </p>
      ) : null}

      <fieldset className="space-y-4 rounded-xl border border-border bg-surface p-4">
        <legend className="px-1 text-sm font-semibold text-foreground">
          Daily figures
        </legend>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label htmlFor={`${formId}-date`} className="text-sm font-medium">
              Date
            </label>
            <input
              id={`${formId}-date`}
              name="entryDate"
              type="date"
              value={entryDate}
              onChange={(event) => setEntryDate(event.target.value)}
              className="min-h-11 rounded-lg border border-border bg-background px-3 text-base"
              required
            />
            {fieldErrors.entryDate ? (
              <p className="text-xs text-danger">{fieldErrors.entryDate}</p>
            ) : null}
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor={`${formId}-earnings`}
              className="text-sm font-medium"
            >
              Total earnings (₹)
            </label>
            <input
              id={`${formId}-earnings`}
              name="totalEarnings"
              type="text"
              inputMode="decimal"
              value={totalEarnings}
              onChange={(event) => setTotalEarnings(event.target.value)}
              placeholder="e.g. 1250.00"
              className="min-h-11 rounded-lg border border-border bg-background px-3 text-base"
            />
            {fieldErrors.totalEarnings ? (
              <p className="text-xs text-danger">{fieldErrors.totalEarnings}</p>
            ) : null}
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor={`${formId}-km`} className="text-sm font-medium">
              Total work kilometres
            </label>
            <input
              id={`${formId}-km`}
              name="totalKm"
              type="text"
              inputMode="decimal"
              value={totalKm}
              onChange={(event) => setTotalKm(event.target.value)}
              placeholder="e.g. 85.5"
              className="min-h-11 rounded-lg border border-border bg-background px-3 text-base"
            />
            {fieldErrors.totalKm ? (
              <p className="text-xs text-danger">{fieldErrors.totalKm}</p>
            ) : null}
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor={`${formId}-petrol`} className="text-sm font-medium">
              Petrol expense (₹)
            </label>
            <input
              id={`${formId}-petrol`}
              name="petrol"
              type="text"
              inputMode="decimal"
              value={petrolAmount}
              onChange={(event) => setPetrolAmount(event.target.value)}
              placeholder="e.g. 320.00"
              className="min-h-11 rounded-lg border border-border bg-background px-3 text-base"
            />
            <p className="text-xs text-muted">
              Saved as a Petrol category expense (not counted twice).
            </p>
            {fieldErrors.petrol ? (
              <p className="text-xs text-danger">{fieldErrors.petrol}</p>
            ) : null}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${formId}-notes`} className="text-sm font-medium">
            Notes (optional)
          </label>
          <textarea
            id={`${formId}-notes`}
            name="notes"
            rows={3}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            className="rounded-lg border border-border bg-background px-3 py-2 text-base"
          />
          {fieldErrors.notes ? (
            <p className="text-xs text-danger">{fieldErrors.notes}</p>
          ) : null}
        </div>
      </fieldset>

      <fieldset className="space-y-3 rounded-xl border border-border bg-surface p-4">
        <legend className="px-1 text-sm font-semibold text-foreground">
          Additional expenses
        </legend>
        {fieldErrors.expenses ? (
          <p className="text-xs text-danger">{fieldErrors.expenses}</p>
        ) : null}

        <ul className="space-y-3">
          {rows.map((row, index) => (
            <li
              key={row.key}
              className="grid gap-3 rounded-lg border border-border p-3 sm:grid-cols-2"
            >
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <label
                  htmlFor={`${formId}-cat-${row.key}`}
                  className="text-sm font-medium"
                >
                  Category {index + 1}
                </label>
                <select
                  id={`${formId}-cat-${row.key}`}
                  value={row.categoryId}
                  onChange={(event) =>
                    updateRow(row.key, "categoryId", event.target.value)
                  }
                  className="min-h-11 rounded-lg border border-border bg-background px-3 text-base"
                >
                  <option value="">Select category</option>
                  {availableCategories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                      {category.isShared ? "" : " (yours)"}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor={`${formId}-amt-${row.key}`}
                  className="text-sm font-medium"
                >
                  Amount (₹)
                </label>
                <input
                  id={`${formId}-amt-${row.key}`}
                  type="text"
                  inputMode="decimal"
                  value={row.amount}
                  onChange={(event) =>
                    updateRow(row.key, "amount", event.target.value)
                  }
                  placeholder="0.00"
                  className="min-h-11 rounded-lg border border-border bg-background px-3 text-base"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor={`${formId}-desc-${row.key}`}
                  className="text-sm font-medium"
                >
                  Description (optional)
                </label>
                <input
                  id={`${formId}-desc-${row.key}`}
                  type="text"
                  value={row.description}
                  onChange={(event) =>
                    updateRow(row.key, "description", event.target.value)
                  }
                  className="min-h-11 rounded-lg border border-border bg-background px-3 text-base"
                />
              </div>
              <div className="sm:col-span-2">
                <button
                  type="button"
                  onClick={() => removeRow(row.key)}
                  className="min-h-11 text-sm font-medium text-danger hover:underline"
                >
                  Remove expense row
                </button>
              </div>
            </li>
          ))}
        </ul>

        <button
          type="button"
          onClick={addRow}
          className="min-h-11 rounded-lg border border-border px-3 text-sm font-medium text-foreground hover:bg-surface-muted"
        >
          Add expense row
        </button>

        <div className="mt-2 flex flex-col gap-2 border-t border-border pt-3 sm:flex-row">
          <input
            type="text"
            value={newCategoryName}
            onChange={(event) => setNewCategoryName(event.target.value)}
            placeholder="New private category name"
            aria-label="New private category name"
            className="min-h-11 flex-1 rounded-lg border border-border bg-background px-3 text-base"
          />
          <button
            type="button"
            onClick={handleCreateCategory}
            disabled={pending || newCategoryName.trim().length === 0}
            className="min-h-11 rounded-lg border border-border px-3 text-sm font-medium hover:bg-surface-muted disabled:opacity-60"
          >
            Add category
          </button>
        </div>
      </fieldset>

      <section
        aria-labelledby={`${formId}-totals`}
        className="rounded-xl border border-dashed border-border bg-surface-muted p-4"
      >
        <h2
          id={`${formId}-totals`}
          className="text-sm font-semibold text-foreground"
        >
          Calculated totals
        </h2>
        <p className="mt-2 text-sm text-muted">
          Net operating profit = total earnings − sum of recorded expenses
          (including petrol). Profit is calculated, not stored separately.
        </p>
        <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-muted">Expense total</dt>
            <dd className="font-medium expense-text">{totals.expensesLabel}</dd>
          </div>
          <div>
            <dt className="text-muted">Net operating profit</dt>
            <dd
              className={[
                "font-medium",
                totals.profit.startsWith("-") ? "expense-text" : "profit-text",
              ].join(" ")}
            >
              {totals.profitLabel}
            </dd>
          </div>
        </dl>
      </section>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Link
          href="/entries"
          className="inline-flex min-h-11 items-center justify-center rounded-lg border border-border px-4 text-sm font-medium text-foreground hover:bg-surface-muted"
        >
          Cancel
        </Link>
        <button
          type="submit"
          disabled={pending}
          className="inline-flex min-h-11 items-center justify-center rounded-lg bg-accent px-4 text-sm font-medium text-accent-foreground hover:opacity-95 disabled:opacity-60"
        >
          {pending ? "Saving…" : mode === "edit" ? "Save changes" : "Save entry"}
        </button>
      </div>

      {mode === "edit" && initialEntry ? (
        <section className="rounded-xl border border-danger/30 bg-danger-soft/40 p-4">
          <h2 className="text-sm font-semibold text-danger">Delete entry</h2>
          <p className="mt-1 text-sm text-muted">
            Deleting this entry also deletes all associated expense rows
            (cascade). This cannot be undone.
          </p>
          {!confirmDelete ? (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="mt-3 min-h-11 rounded-lg border border-danger px-3 text-sm font-medium text-danger"
            >
              Delete this entry…
            </button>
          ) : (
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleDelete}
                disabled={pending}
                className="min-h-11 rounded-lg bg-danger px-3 text-sm font-medium text-white disabled:opacity-60"
              >
                {pending ? "Deleting…" : "Yes, delete entry"}
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="min-h-11 rounded-lg border border-border px-3 text-sm font-medium"
              >
                Keep entry
              </button>
            </div>
          )}
        </section>
      ) : null}
    </form>
  );
}
