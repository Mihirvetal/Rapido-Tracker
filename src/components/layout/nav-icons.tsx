import {
  BarChart3,
  LayoutDashboard,
  PlusCircle,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import type { NavItem } from "@/types";

const ICONS: Record<NavItem["icon"], LucideIcon> = {
  dashboard: LayoutDashboard,
  add: PlusCircle,
  reports: BarChart3,
  profile: UserRound,
};

interface NavIconProps {
  name: NavItem["icon"];
  className?: string;
}

export function NavIcon({ name, className }: NavIconProps) {
  const Icon = ICONS[name];
  return <Icon className={className} aria-hidden />;
}
