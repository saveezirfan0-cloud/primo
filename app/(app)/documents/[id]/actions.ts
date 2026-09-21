"use server";

import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase/server";
import { saveProcessedJob } from "@/lib/ingest/save";
import type { ProcessedJob } from "@/lib/ingest/types";

export async function confirmDocument(formData: FormData) {
  const id = String(formData.get("document_id") ?? "");
  const isHoldout = formData.get("is_holdout") === "on";
  const db = supabaseAdmin();
  const { data: doc, error } = await db.from("documents").select("id, status, extraction, job_id").eq("id", id).single();
  if (error || !doc) redirect("/library");
  if (doc.status === "confirmed") redirect(doc.job_id ? `/jobs/${doc.job_id}` : "/library");
  const extraction = doc.extraction as { processed?: ProcessedJob } | null;
  if (!extraction?.processed) redirect(`/documents/${id}?error=${encodeURIComponent("This document has no extraction to save.")}`);
  let jobId: string;
  try {
    jobId = await saveProcessedJob(extraction.processed, { documentId: id, isHoldout });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Save failed.";
    redirect(`/documents/${id}?error=${encodeURIComponent(message.slice(0, 300))}`);
  }
  redirect(`/jobs/${jobId}`);
}

export async function discardDocument(formData: FormData) {
  const id = String(formData.get("document_id") ?? "");
  await supabaseAdmin().from("documents").update({ status: "discarded" }).eq("id", id);
  redirect("/upload");
}
