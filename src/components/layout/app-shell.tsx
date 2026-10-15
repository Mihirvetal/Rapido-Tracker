import type { ReactNode } from "react";
import { AppHeader } from "@/components/layout/app-header";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { BottomNavigation } from "@/components/layout/bottom-navigation";

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="flex min-h-full flex-1 bg-background">
      <AppSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <AppHeader />
        <main
          id="main-content"
          className="flex-1 pb-[calc(var(--bottom-nav-height)+var(--safe-bottom)+0.5rem)] md:pb-0"
        >
          {children}
        </main>
        <BottomNavigation />
      </div>
    </div>
  );
}
