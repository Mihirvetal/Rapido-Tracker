import Link from "next/link";
import { Plus } from "lucide-react";
import { Suspense } from "react";
import { DashboardError } from "@/components/dashboard/dashboard-error";
import { MetricCard } from "@/components/dashboard/metric-card";
import { RecentEntries } from "@/components/dashboard/recent-entries";
import { PageHeading } from "@/components/ui/page-heading";
import { fetchDashboardData } from "@/lib/dashboard/queries";
import { createClient } from "@/lib/supabase/server";

export const instant = false;

async function DashboardContent() {
  const supabase = await createClient();
  const data = await fetchDashboardData(supabase);

  if (!data.ok) {
    return <DashboardError message={data.message} />;
  }

  return (
    <>
      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {data.metrics.map((metric) => (
          <MetricCard key={metric.id} metric={metric} />
        ))}
      </div>

      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <Link
          href="/entries/new"
          className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 text-sm font-semibold text-accent-foreground hover:opacity-95 sm:w-auto"
        >
          <Plus className="h-5 w-5" aria-hidden />
          Add Entry
        </Link>
        <Link
          href="/entries"
          className="inline-flex min-h-12 items-center justify-center text-sm font-medium text-accent hover:underline"
        >
          View entry history
        </Link>
      </div>

      <div className="mt-8">
        <RecentEntries entries={data.recentEntries} />
      </div>
    </>
  );
}

export default function DashboardPage() {
  return (
    <div className="page-container">
      <PageHeading
        title="Dashboard"
        description="Live earnings and profit from your saved daily entries."
      />
      <Suspense
        fallback={
          <p className="mt-5 text-sm text-muted" role="status">
            Loading dashboard…
          </p>
        }
      >
        <DashboardContent />
      </Suspense>
    </div>
  );
}
