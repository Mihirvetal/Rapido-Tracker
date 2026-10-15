import type { NavItem } from "@/types";

export const NAV_ITEMS: NavItem[] = [
  {
    href: "/",
    label: "Dashboard",
    mobileLabel: "Home",
    icon: "dashboard",
  },
  {
    href: "/entries/new",
    label: "Daily Entry",
    mobileLabel: "Add Entry",
    icon: "add",
    isPrimary: true,
  },
  {
    href: "/reports",
    label: "Reports",
    mobileLabel: "Reports",
    icon: "reports",
  },
  {
    href: "/profile",
    label: "Profile",
    mobileLabel: "Profile",
    icon: "profile",
  },
];

export function isNavActive(pathname: string, href: string): boolean {
  if (href === "/") {
    return pathname === "/";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}
