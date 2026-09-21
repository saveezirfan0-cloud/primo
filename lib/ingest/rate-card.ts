import "server-only";
import { supabaseAdmin } from "@/lib/supabase/server";
import type { RateCardEntry } from "./types";

export async function loadRateCard(): Promise<RateCardEntry[]> {
  const { data, error } = await supabaseAdmin().from("rate_card").select("code, rate, unit");
  if (error) throw new Error(`rate_card: ${error.message}`);
  return (data ?? []).map((r) => ({ code: r.code, rate: r.rate === null ? null : Number(r.rate), unit: r.unit }));
}
