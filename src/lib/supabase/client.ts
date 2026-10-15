import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseEnv } from "@/lib/supabase/env";

/** Browser Supabase client (publishable key only). Singleton via @supabase/ssr. */
export function createClient() {
  const { url, publishableKey } = getSupabaseEnv();
  return createBrowserClient(url, publishableKey);
}
