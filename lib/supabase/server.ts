import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { requireEnv } from "@/lib/env";
import type { Database } from "@/lib/supabase/types";

let cached: SupabaseClient<Database> | null = null;

/**
 * Server-side Supabase client using the service role key.
 *
 * All tables have RLS enabled with no anon policies, so every read and write
 * goes through this client from route handlers, server components and server
 * actions. Never import this from a client component.
 */
export function supabaseAdmin(): SupabaseClient<Database> {
  if (cached) return cached;
  cached = createClient<Database>(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  return cached;
}
