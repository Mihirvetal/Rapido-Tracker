import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { ReportDayCell, ReportMonthView } from "@/types/reports";

interface MonthReportViewProps {
  report: ReportMonthView;
}

export function MonthReportView({ report }: MonthReportViewProps) {
  const { month, summary, days, entries, calendarStartOffset } = report;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href="/reports"
          className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border bg-surface px-3 text-sm font-medium text-foreground hover:bg-surface-muted"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          All months
        </Link>
        <p className="text-sm text-muted">Report for {month.label}</p>
      </div>

      <section aria-labelledby="month-summary-heading">
        <h2
          id="month-summary-heading"
          className="mb-3 text-base font-semibold text-foreground"
        >
          {month.label} summary
        </h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <SummaryCard label="Earnings" value={summary.earningsLabel} tone="profit" />
          <SummaryCard
            label="Expenses"
            value={summary.expensesLabel}
            tone="expense"
          />
          <SummaryCard
            label="Net profit"
            value={summary.netProfitLabel}
            tone={summary.netProfitNegative ? "expense" : "profit"}
          />
          <SummaryCard label="Kilometres" value={summary.kilometresLabel} />
        </div>
        {summary.entryCount === 0 ? (
          <p className="mt-3 text-sm text-muted">
            No saved entries in this month. Unrecorded days are not treated as
            zero-earning days.
          </p>
        ) : null}
      </section>

      <section aria-labelledby="calendar-heading">
        <h2
          id="calendar-heading"
          className="mb-3 text-base font-semibold text-foreground"
        >
          Daily overview
        </h2>
        <p className="mb-3 text-sm text-muted">
          Red = expenses, green = net profit. Days without an entry can open Add
          Entry for that date.
        </p>
        <div className="rounded-xl border border-border bg-surface p-2 sm:p-3">
          <div
            className="grid w-full grid-cols-7 gap-1 sm:gap-1.5"
            role="grid"
            aria-label={`Calendar for ${month.label}`}
          >
            {["S", "M", "T", "W", "T", "F", "S"].map((label, index) => (
              <div
                key={`${label}-${index}`}
                className="py-1 text-center text-xs font-medium text-muted"
                role="columnheader"
              >
                {label}
              </div>
            ))}
            {Array.from({ length: calendarStartOffset }).map((_, index) => (
              <div key={`pad-${index}`} className="min-h-14" aria-hidden />
            ))}
            {days.map((day) => (
              <CalendarDayCell key={day.date} day={day} />
            ))}
          </div>
        </div>
      </section>

      <DailyEntriesSection monthLabel={month.label} entries={entries} />
    </div>
  );
}

function CalendarDayCell({ day }: { day: ReportDayCell }) {
  const className = [
    "min-h-12 min-w-0 touch-manipulation overflow-hidden rounded-lg border p-0.5 text-left sm:min-h-14 sm:p-1",
    day.hasEntry
      ? "border-border bg-background hover:bg-accent-soft"
      : "border-transparent bg-surface-muted/50 hover:bg-surface-muted",
  ].join(" ");

  if (day.hasEntry && day.entryId) {
    return (
      <Link
        href={`/entries/${day.entryId}`}
        role="gridcell"
        aria-label={`Open entry for ${day.date}`}
        className={`block ${className}`}
      >
        <p className="text-xs font-semibold text-foreground">{day.day}</p>
        <p className="truncate text-[0.65rem] expense-text">
          −{day.expenseLabel}
        </p>
        <p
          className={[
            "truncate text-[0.65rem]",
            day.profitLabel?.startsWith("-") ? "expense-text" : "profit-text",
          ].join(" ")}
        >
          {day.profitLabel}
        </p>
        {day.zeroEarnings ? (
          <p className="truncate text-[0.6rem] text-muted">₹0 earn</p>
        ) : null}
      </Link>
    );
  }

  return (
    <Link
      href={`/entries/new?date=${day.date}`}
      role="gridcell"
      aria-label={`Add entry for ${day.date}`}
      className={`block ${className}`}
    >
      <p className="text-xs font-semibold text-foreground">{day.day}</p>
      <p className="text-[0.65rem] text-muted">Add</p>
    </Link>
  );
}

function DailyEntriesSection({
  monthLabel,
  entries,
}: {
  monthLabel: string;
  entries: ReportMonthView["entries"];
}) {
  return (
    <section aria-labelledby="entries-table-heading">
      <h2
        id="entries-table-heading"
        className="mb-3 text-base font-semibold text-foreground"
      >
        Daily entries
      </h2>

      {entries.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-surface-muted p-4 text-sm text-muted">
          No entries saved in {monthLabel}.{" "}
          <Link
            href="/entries/new"
            className="font-medium text-accent hover:underline"
          >
            Add an entry
          </Link>
        </div>
      ) : (
        <>
          <ul className="flex flex-col gap-3 md:hidden">
            {entries.map((entry) => (
              <li key={entry.id}>
                <Link
                  href={`/entries/${entry.id}`}
                  className="block rounded-xl border border-border bg-surface p-4 text-sm hover:bg-surface-muted"
                >
                  <p className="font-medium">{entry.entryDate}</p>
                  <p className="mt-1 profit-text">{entry.earningsLabel}</p>
                  <p className="expense-text">Expenses {entry.expensesLabel}</p>
                  <p
                    className={
                      entry.netProfitNegative ? "expense-text" : "profit-text"
                    }
                  >
                    Profit {entry.netProfitLabel}
                  </p>
                  <p className="text-muted">{entry.kilometresLabel}</p>
                </Link>
              </li>
            ))}
          </ul>

          <div className="hidden overflow-x-auto rounded-xl border border-border md:block">
            <table className="w-full min-w-[36rem] border-collapse text-left text-sm">
              <caption className="sr-only">
                Daily entries for {monthLabel}
              </caption>
              <thead className="bg-surface-muted text-muted">
                <tr>
                  <th scope="col" className="px-3 py-2.5 font-medium">
                    Date
                  </th>
                  <th scope="col" className="px-3 py-2.5 font-medium">
                    Earnings
                  </th>
                  <th scope="col" className="px-3 py-2.5 font-medium">
                    Expenses
                  </th>
                  <th scope="col" className="px-3 py-2.5 font-medium">
                    Profit
                  </th>
                  <th scope="col" className="px-3 py-2.5 font-medium">
                    Kilometres
                  </th>
                  <th scope="col" className="px-3 py-2.5 font-medium">
                    <span className="sr-only">Open</span>
                  </th>
                </tr>
              </thead>
              <tbody className="bg-surface">
                {entries.map((entry) => (
                  <tr key={entry.id} className="border-t border-border">
                    <td className="px-3 py-2.5">
                      <Link
                        href={`/entries/${entry.id}`}
                        className="font-medium text-accent underline-offset-2 hover:underline"
                      >
                        {entry.entryDate}
                      </Link>
                    </td>
                    <td className="px-3 py-2.5 profit-text">
                      {entry.earningsLabel}
                    </td>
                    <td className="px-3 py-2.5 expense-text">
                      {entry.expensesLabel}
                    </td>
                    <td
                      className={[
                        "px-3 py-2.5",
                        entry.netProfitNegative
                          ? "expense-text"
                          : "profit-text",
                      ].join(" ")}
                    >
                      {entry.netProfitLabel}
                    </td>
                    <td className="px-3 py-2.5">{entry.kilometresLabel}</td>
                    <td className="px-3 py-2.5">
                      <Link
                        href={`/entries/${entry.id}`}
                        className="font-medium text-accent hover:underline"
                      >
                        Edit
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}

function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "profit" | "expense";
}) {
  const valueClass =
    tone === "profit"
      ? "profit-text"
      : tone === "expense"
        ? "expense-text"
        : "text-foreground";

  return (
    <article className="min-w-0 rounded-xl border border-border bg-surface p-3 sm:p-4">
      <p className="text-sm text-muted">{label}</p>
      <p
        className={`mt-1 break-words text-base font-semibold tabular-nums sm:text-lg ${valueClass}`}
      >
        {value}
      </p>
    </article>
  );
}
