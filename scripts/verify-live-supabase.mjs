/**
 * Non-destructive probes against the configured Supabase project (anon key only).
 * Never resets or deletes remote data. Fails if the app schema is missing.
 *
 * Usage: node scripts/verify-live-supabase.mjs
 * Env: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (.env or env)
 */
import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

function loadEnvFile(path) {
  if (!existsSync(path)) return {};
  const out = {};
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#") || !t.includes("=")) continue;
    const i = t.indexOf("=");
    out[t.slice(0, i).trim()] = t.slice(i + 1).trim();
  }
  return out;
}

const fileEnv = {
  ...loadEnvFile(join(process.cwd(), ".env")),
  ...loadEnvFile(join(process.cwd(), ".env.local")),
};
const url =
  process.env.NEXT_PUBLIC_SUPABASE_URL || fileEnv.NEXT_PUBLIC_SUPABASE_URL;
const key =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  fileEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!url || !key || url.includes("your-project") || key.includes("your-publishable")) {
  console.error("verify-live-supabase: SKIP — configure NEXT_PUBLIC_SUPABASE_* first");
  process.exit(2);
}

const host = url.replace(/^https?:\/\//, "").split("/")[0];
const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const results = [];

async function check(name, fn) {
  try {
    const detail = await fn();
    results.push({ name, ok: true, detail });
  } catch (error) {
    results.push({
      name,
      ok: false,
      detail: error instanceof Error ? error.message : String(error),
    });
  }
}

function assertSchemaPresent(error, label) {
  if (error && (error.code === "PGRST205" || /schema cache|could not find the table/i.test(error.message))) {
    throw new Error(
      `SCHEMA_MISSING: ${label} — apply supabase/migrations to this project before production`,
    );
  }
}

await check("schema_daily_entries_exists", async () => {
  const { error } = await supabase.from("daily_entries").select("id").limit(1);
  assertSchemaPresent(error, "daily_entries");
  // Permission/RLS errors are OK; missing table is not.
  return error ? `reachable error=${error.code || error.message}` : "reachable";
});

await check("anon_cannot_read_entries", async () => {
  const { data, error } = await supabase.from("daily_entries").select("id").limit(5);
  assertSchemaPresent(error, "daily_entries");
  if (error) {
    // permission denied / JWT is acceptable for anon
    return `denied code=${error.code || "n/a"}`;
  }
  if ((data ?? []).length > 0) {
    throw new Error(`LEAK: anon read ${(data ?? []).length} entry rows`);
  }
  return "rows=0";
});

await check("anon_cannot_insert_entry", async () => {
  const { error } = await supabase.from("daily_entries").insert({
    user_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    entry_date: "2099-01-01",
    total_earnings: 1,
    total_km: 1,
  });
  assertSchemaPresent(error, "daily_entries");
  if (!error) throw new Error("LEAK: anon insert succeeded");
  return `rejected code=${error.code || "n/a"}`;
});

await check("anon_cannot_update_shared_category", async () => {
  const { error } = await supabase
    .from("expense_categories")
    .update({ name: "Hacked Petrol" })
    .eq("id", "a0000000-0000-4000-8000-000000000001");
  assertSchemaPresent(error, "expense_categories");
  if (!error) throw new Error("LEAK: anon updated shared category");
  return `rejected code=${error.code || "n/a"}`;
});

await check("bad_password_no_session", async () => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: `phase9-probe-${Date.now()}@example.invalid`,
    password: "definitely-wrong-password-xxx",
  });
  if (data.session) throw new Error("LEAK: session for bad credentials");
  if (!error) throw new Error("expected auth error");
  return "no_session";
});

console.log(
  JSON.stringify(
    {
      host,
      destructive: false,
      results,
    },
    null,
    2,
  ),
);

const failed = results.filter((r) => !r.ok);
if (failed.length) {
  console.error(
    `verify-live-supabase: FAIL (${failed.length}) — ${failed.map((f) => f.name).join(", ")}`,
  );
  process.exit(1);
}
console.log("verify-live-supabase: ok");
