import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { ReportMonthOption } from "@/types/reports";

interface MonthListProps {
  months: ReportMonthOption[];
}

export function MonthList({ months }: MonthListProps) {
  if (months.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-surface-muted p-5 text-sm text-muted">
        <p>No monthly reports yet.</p>
        <p className="mt-2">
          Months appear here after you save your first daily entry for that
          month.{" "}
          <Link
            href="/entries/new"
            className="font-medium text-accent hover:underline"
          >
            Add an entry
          </Link>
        </p>
      </div>
    );
  }

  return (
    <section aria-labelledby="month-list-heading">
      <h2
        id="month-list-heading"
        className="mb-3 text-base font-semibold text-foreground"
      >
        Select month
      </h2>
      <ul className="flex flex-col gap-2">
        {months.map((month) => (
          <li key={month.id}>
            <Link
              href={`/reports?month=${month.id}`}
              className="flex min-h-14 w-full items-center justify-between gap-3 rounded-xl border border-border bg-surface px-4 text-left transition-colors hover:bg-surface-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
            >
              <span>
                <span className="block text-sm font-medium text-foreground">
                  {month.label}
                </span>
                <span className="mt-0.5 block text-xs text-muted">
                  Open monthly report
                </span>
              </span>
              <ChevronRight
                className="h-5 w-5 shrink-0 text-muted"
                aria-hidden
              />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
