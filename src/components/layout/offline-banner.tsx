"use client";

import { useOffline } from "next/offline";

/**
 * Connectivity banner only. Does not cache or serve private financial data.
 * Relies on Next.js experimental.useOffline (online/offline + request retry).
 */
export function OfflineBanner() {
  const isOffline = useOffline();

  if (!isOffline) {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="border-b border-border bg-surface-muted px-4 py-2 text-center text-sm text-foreground"
    >
      You are offline. Live earnings and saves need a connection — nothing was
      stored for offline use.
    </div>
  );
}
