"use client";
import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/supabase/types";

/**
 * Browser Supabase client (anon key). Tables are RLS-protected with no anon
 * policies, so this is only useful for Storage signed-URL flows and any future
 * realtime subscriptions. Data access goes through server code.
 */
export function supabaseBrowser() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
  );
}
