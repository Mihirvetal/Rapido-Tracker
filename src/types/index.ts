export interface NavItem {
  href: string;
  label: string;
  mobileLabel: string;
  icon: "dashboard" | "add" | "reports" | "profile";
  isPrimary?: boolean;
}
