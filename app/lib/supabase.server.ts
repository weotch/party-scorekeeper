import { createClient, type SupabaseClient } from "@supabase/supabase-js";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable ${name}`);
  return value;
}

let client: SupabaseClient | undefined;

/**
 * Server-only client. The secret key bypasses RLS, so it must never reach the
 * browser. Created on first use so a missing key fails the request that needs
 * it instead of crashing the whole server at startup.
 */
export function db(): SupabaseClient {
  client ??= createClient(requireEnv("SUPABASE_URL"), requireEnv("SUPABASE_SECRET_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}
