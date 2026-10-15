"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NavIcon } from "@/components/layout/nav-icons";
import { isNavActive, NAV_ITEMS } from "@/lib/navigation";

export function BottomNavigation() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Mobile"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface pb-[var(--safe-bottom)] md:hidden"
    >
      <ul className="grid h-[var(--bottom-nav-height)] grid-cols-4">
        {NAV_ITEMS.map((item) => {
          const active = isNavActive(pathname, item.href);
          return (
            <li key={item.href} className="min-w-0">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                aria-label={item.mobileLabel}
                className={[
                  "flex h-full min-h-12 touch-manipulation flex-col items-center justify-center gap-0.5 px-1 text-[0.65rem] font-medium",
                  item.isPrimary
                    ? "text-accent"
                    : active
                      ? "text-accent"
                      : "text-muted",
                ].join(" ")}
              >
                <span
                  className={[
                    "flex h-8 w-8 items-center justify-center rounded-full",
                    item.isPrimary ? "bg-accent text-accent-foreground" : "",
                  ].join(" ")}
                >
                  <NavIcon
                    name={item.icon}
                    className={item.isPrimary ? "h-5 w-5" : "h-[1.15rem] w-[1.15rem]"}
                  />
                </span>
                <span className="truncate">{item.mobileLabel}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
