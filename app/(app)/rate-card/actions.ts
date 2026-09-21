"use server";

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase/server";

export async function updateRateCard(formData: FormData) {
  const db = supabaseAdmin();
  const codes = formData.getAll("code").map(String);
  for (const code of codes) {
    const raw = String(formData.get(`rate:${code}`) ?? "").trim();
    const unit = String(formData.get(`unit:${code}`) ?? "hour");
    const rate = raw === "" ? null : Number(raw);
    if (rate !== null && !Number.isFinite(rate)) continue;
    const { error } = await db.from("rate_card").update({ rate, unit, updated_at: new Date().toISOString() }).eq("code", code);
    if (error) throw new Error(error.message);
  }
  revalidatePath("/rate-card");
  revalidatePath("/price-book");
}
