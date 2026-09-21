"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createEstimateFromBrief, generateAndSaveDraft, saveDraft, saveSpec } from "@/lib/estimates/server";
import { Spec } from "@/lib/schemas/spec";
import type { Draft } from "@/lib/draft/types";
import type { MatchResult } from "@/lib/match/score";

export async function startEstimate(formData: FormData) {
  const brief = String(formData.get("brief") ?? "").trim();
  if (brief.length < 20) redirect("/estimates/new?error=short");
  let id: string;
  try {
    id = await createEstimateFromBrief(brief);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Parsing failed.";
    redirect(`/estimates/new?error=${encodeURIComponent(message.slice(0, 300))}&brief=${encodeURIComponent(brief.slice(0, 4000))}`);
  }
  redirect(`/estimates/${id}`);
}

export async function updateSpecAction(id: string, spec: unknown): Promise<{ ok: boolean; message?: string; matches?: MatchResult[] }> {
  const parsed = Spec.safeParse(spec);
  if (!parsed.success) return { ok: false, message: parsed.error.issues.slice(0, 3).map((i) => i.message).join("; ") };
  try {
    const matches = await saveSpec(id, parsed.data);
    revalidatePath(`/estimates/${id}`);
    return { ok: true, matches };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Save failed." };
  }
}

export async function generateDraftAction(id: string): Promise<{ ok: boolean; message?: string }> {
  try {
    await generateAndSaveDraft(id);
    revalidatePath(`/estimates/${id}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Generation failed." };
  }
}

export async function saveDraftAction(id: string, draft: Draft, compareJobNumber: string | null): Promise<{ ok: boolean; message?: string }> {
  try {
    await saveDraft(id, draft, compareJobNumber || null);
    revalidatePath(`/estimates/${id}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Save failed." };
  }
}
