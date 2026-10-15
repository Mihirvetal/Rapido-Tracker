import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { DailyEntryForm } from "@/components/entries/daily-entry-form";
import { PageHeading } from "@/components/ui/page-heading";
import { isValidIsoDate, todayInKolkata } from "@/lib/dates";
import { fetchExpenseCategories } from "@/lib/entries/queries";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "New daily entry",
};

export const instant = false;

interface NewEntryPageProps {
  searchParams: Promise<{ date?: string | string[] }>;
}

async function NewEntryForm({ preferredDate }: { preferredDate?: string }) {
  const supabase = await createClient();
  const categories = await fetchExpenseCategories(supabase);
  const defaultDate =
    preferredDate && isValidIsoDate(preferredDate)
      ? preferredDate
      : todayInKolkata();

  return (
    <DailyEntryForm
      mode="create"
      categories={categories}
      defaultDate={defaultDate}
    />
  );
}

export default async function NewDailyEntryPage({
  searchParams,
}: NewEntryPageProps) {
  const params = await searchParams;
  const rawDate = params.date;
  const preferredDate = Array.isArray(rawDate) ? rawDate[0] : rawDate;

  return (
    <div className="page-container">
      <PageHeading
        title="Daily Entry"
        description="Record earnings, kilometres, and expenses for one day."
      />
      <p className="mb-5 text-sm text-muted">
        <Link href="/entries" className="font-medium text-accent hover:underline">
          View entry history
        </Link>
      </p>
      <Suspense
        fallback={
          <p className="text-sm text-muted" role="status">
            Loading form…
          </p>
        }
      >
        <NewEntryForm preferredDate={preferredDate} />
      </Suspense>
    </div>
  );
}
