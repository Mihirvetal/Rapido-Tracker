import type { Metadata } from "next";
import { Suspense } from "react";
import { DashboardError } from "@/components/dashboard/dashboard-error";
import { MonthList } from "@/components/reports/month-list";
import { MonthReportView } from "@/components/reports/month-report-view";
import { PageHeading } from "@/components/ui/page-heading";
import { parseYearMonth } from "@/lib/dates";
import {
  fetchMonthReport,
  fetchReportMonths,
} from "@/lib/reports/queries";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Reports",
};

export const instant = false;

interface ReportsPageProps {
  searchParams: Promise<{ month?: string | string[] }>;
}

async function ReportsContent({
  monthParam,
}: {
  monthParam: string | undefined;
}) {
  const supabase = await createClient();

  if (monthParam !== undefined) {
    const parsed = parseYearMonth(monthParam);
    if (!parsed) {
      return (
        <DashboardError message="Invalid month. Use a value like 2026-10." />
      );
    }

    const result = await fetchMonthReport(supabase, parsed.id);
    if (!result.ok) {
      return <DashboardError message={result.message} />;
    }
    return <MonthReportView report={result.report} />;
  }

  const monthsResult = await fetchReportMonths(supabase);
  if (!monthsResult.ok) {
    return <DashboardError message={monthsResult.message} />;
  }

  return <MonthList months={monthsResult.months} />;
}

export default async function ReportsPage({ searchParams }: ReportsPageProps) {
  const params = await searchParams;
  const rawMonth = params.month;
  const monthParam = Array.isArray(rawMonth) ? rawMonth[0] : rawMonth;

  return (
    <div className="page-container">
      <PageHeading
        title="Monthly Reports"
        description="Choose a month to view its summary and daily breakdown."
      />
      <Suspense
        fallback={
          <p className="mt-5 text-sm text-muted" role="status">
            Loading reports…
          </p>
        }
      >
        <ReportsContent monthParam={monthParam} />
      </Suspense>
    </div>
  );
}
