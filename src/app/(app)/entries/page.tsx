import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Suspense } from "react";
import { DashboardError } from "@/components/dashboard/dashboard-error";
import { EntryHistoryList } from "@/components/entries/entry-history-list";
import { PageHeading } from "@/components/ui/page-heading";
import { fetchEntryHistory } from "@/lib/entries/queries";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Entry history",
};

export const instant = false;

async function HistoryContent() {
  const supabase = await createClient();
  const result = await fetchEntryHistory(supabase);

  if (!result.ok) {
    return <DashboardError message={result.message} />;
  }

  return <EntryHistoryList entries={result.entries} />;
}

export default function EntriesHistoryPage() {
  return (
    <div className="page-container">
      <PageHeading
        title="Entry history"
        description="Your saved daily earnings and expense records."
      />
      <div className="mb-5">
        <Link
          href="/entries/new"
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-accent px-4 text-sm font-semibold text-accent-foreground hover:opacity-95"
        >
          <Plus className="h-4 w-4" aria-hidden />
          Add entry
        </Link>
      </div>
      <Suspense
        fallback={
          <p className="text-sm text-muted" role="status">
            Loading history…
          </p>
        }
      >
        <HistoryContent />
      </Suspense>
    </div>
  );
}
