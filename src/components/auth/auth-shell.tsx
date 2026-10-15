import { Bike } from "lucide-react";
import type { ReactNode } from "react";

interface AuthShellProps {
  title: string;
  description?: string;
  children: ReactNode;
}

export function AuthShell({ title, description, children }: AuthShellProps) {
  return (
    <div className="flex min-h-full flex-1 flex-col items-center justify-center bg-background px-4 pt-[max(2.5rem,var(--safe-top))] pb-[max(2.5rem,var(--safe-bottom))]">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center text-center">
          <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-accent text-accent-foreground">
            <Bike className="h-6 w-6" aria-hidden />
          </span>
          <p className="text-sm font-semibold text-accent">
            Rapido Income Tracker
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
            {title}
          </h1>
          {description ? (
            <p className="mt-1 text-sm text-muted">{description}</p>
          ) : null}
        </div>
        <div
          id="main-content"
          className="rounded-xl border border-border bg-surface p-5 shadow-sm"
        >
          {children}
        </div>
      </div>
    </div>
  );
}
