import { Bike } from "lucide-react";

export function AppHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-surface/95 pt-[var(--safe-top)] backdrop-blur md:hidden">
      <div className="flex h-[var(--header-height)] items-center gap-2.5 px-4">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-accent-foreground">
          <Bike className="h-4 w-4" aria-hidden />
        </span>
        <div>
          <p className="text-sm font-semibold leading-tight text-foreground">
            Rapido Income Tracker
          </p>
          <p className="text-xs text-muted">Daily earnings &amp; expenses</p>
        </div>
      </div>
    </header>
  );
}
