"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bike } from "lucide-react";
import { NavIcon } from "@/components/layout/nav-icons";
import { isNavActive, NAV_ITEMS } from "@/lib/navigation";

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex md:w-[var(--sidebar-width)] md:shrink-0 md:flex-col md:border-r md:border-border md:bg-surface">
      <div className="flex items-center gap-2.5 border-b border-border px-5 py-5">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent text-accent-foreground">
          <Bike className="h-5 w-5" aria-hidden />
        </span>
        <div>
          <p className="text-sm font-semibold leading-tight text-foreground">
            Rapido Income
          </p>
          <p className="text-xs text-muted">Tracker</p>
        </div>
      </div>

      <nav aria-label="Main" className="flex flex-1 flex-col gap-1 p-3">
        {NAV_ITEMS.map((item) => {
          const active = isNavActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={[
                "flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors",
                active
                  ? "bg-accent-soft text-accent"
                  : "text-foreground hover:bg-surface-muted",
              ].join(" ")}
            >
              <NavIcon name={item.icon} className="h-5 w-5 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <p className="border-t border-border px-5 py-4 text-xs text-muted">
        Phase 1 foundation — mock data only
      </p>
    </aside>
  );
}
