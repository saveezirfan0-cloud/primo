"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase/server";

export async function updateRateCard(formData: FormData) {
  const db = supabaseAdmin();
  const codes = formData.getAll("code").map(String);
  const problems: string[] = [];
  const updates: { code: string; rate: number | null; unit: string }[] = [];
  for (const code of codes) {
    const raw = String(formData.get(`rate:${code}`) ?? "").trim().replace(/^\$/, "");
    const unit = String(formData.get(`unit:${code}`) ?? "hour") === "item" ? "item" : "hour";
    const rate = raw === "" ? null : Number(raw);
    if (rate !== null && (!Number.isFinite(rate) || rate < 0)) {
      problems.push(`${code}: "${raw}" is not a valid rate`);
      continue;
    }
    updates.push({ code, rate: rate === null ? null : Math.round(rate * 100) / 100, unit });
  }
  if (problems.length) redirect(`/rate-card?error=${encodeURIComponent(problems.join("; "))}`);
  for (const u of updates) {
    const { error } = await db.from("rate_card").update({ rate: u.rate, unit: u.unit, updated_at: new Date().toISOString() }).eq("code", u.code);
    if (error) redirect(`/rate-card?error=${encodeURIComponent(error.message)}`);
  }
  revalidatePath("/rate-card");
  revalidatePath("/price-book");
  redirect("/rate-card?saved=1");
}
