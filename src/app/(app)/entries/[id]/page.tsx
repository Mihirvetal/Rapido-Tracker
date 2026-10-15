import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { DailyEntryForm } from "@/components/entries/daily-entry-form";
import { PageHeading } from "@/components/ui/page-heading";
import { todayInKolkata } from "@/lib/dates";
import {
  fetchDailyEntry,
  fetchExpenseCategories,
  splitPetrolFromExpenses,
} from "@/lib/entries/queries";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Edit daily entry",
};

export const instant = false;

interface EditEntryPageProps {
  params: Promise<{ id: string }>;
}

async function EditEntryContent({ id }: { id: string }) {
  const supabase = await createClient();
  const [entry, categories] = await Promise.all([
    fetchDailyEntry(supabase, id),
    fetchExpenseCategories(supabase),
  ]);

  if (!entry) {
    notFound();
  }

  const { petrolAmount } = splitPetrolFromExpenses(entry.expenses);

  return (
    <DailyEntryForm
      mode="edit"
      categories={categories}
      defaultDate={todayInKolkata()}
      initialEntry={entry}
      initialPetrolAmount={petrolAmount === "0.00" ? "0" : petrolAmount}
    />
  );
}

export default async function EditEntryPage({ params }: EditEntryPageProps) {
  const { id } = await params;

  return (
    <div className="page-container">
      <PageHeading
        title="Edit daily entry"
        description="Update earnings, kilometres, and expenses for this day."
      />
      <p className="mb-5 text-sm text-muted">
        <Link href="/entries" className="font-medium text-accent hover:underline">
          Back to history
        </Link>
      </p>
      <Suspense
        fallback={
          <p className="text-sm text-muted" role="status">
            Loading entry…
          </p>
        }
      >
        <EditEntryContent id={id} />
      </Suspense>
    </div>
  );
}
