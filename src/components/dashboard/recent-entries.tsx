import Link from "next/link";
import { formatDisplayDate, formatKm } from "@/lib/format";
import { formatInrExact } from "@/lib/money";
import type { DailyEntryListItem } from "@/types/entries";

interface RecentEntriesProps {
  entries: DailyEntryListItem[];
}

export function RecentEntries({ entries }: RecentEntriesProps) {
  return (
    <section aria-labelledby="recent-entries-heading">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2
          id="recent-entries-heading"
          className="text-base font-semibold text-foreground"
        >
          Recent entries
        </h2>
        <Link
          href="/entries"
          className="text-sm font-medium text-accent hover:underline"
        >
          Full history
        </Link>
      </div>

      {entries.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-surface-muted p-5 text-sm text-muted">
          <p>No saved entries yet.</p>
          <p className="mt-2">
            <Link
              href="/entries/new"
              className="font-medium text-accent hover:underline"
            >
              Add your first daily entry
            </Link>
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {entries.map((entry) => {
            const profitNegative = entry.netProfit.startsWith("-");
            return (
              <li key={entry.id}>
                <Link
                  href={`/entries/${entry.id}`}
                  className="block rounded-xl border border-border bg-surface p-4 hover:bg-surface-muted"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-foreground">
                        {formatDisplayDate(entry.entryDate)}
                      </p>
                      <p className="mt-0.5 text-sm text-muted">
                        {formatKm(Number(entry.totalKm))}
                      </p>
                    </div>
                    <p
                      className={[
                        "text-sm font-semibold",
                        profitNegative ? "expense-text" : "profit-text",
                      ].join(" ")}
                    >
                      {formatInrExact(entry.netProfit)}
                    </p>
                  </div>
                  <dl className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
                    <div>
                      <dt className="text-muted">Earnings</dt>
                      <dd className="font-medium profit-text">
                        {formatInrExact(entry.totalEarnings)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted">Expenses</dt>
                      <dd className="font-medium expense-text">
                        {formatInrExact(entry.totalExpenses)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted">Net profit</dt>
                      <dd
                        className={[
                          "font-medium",
                          profitNegative ? "expense-text" : "profit-text",
                        ].join(" ")}
                      >
                        {formatInrExact(entry.netProfit)}
                      </dd>
                    </div>
                  </dl>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
