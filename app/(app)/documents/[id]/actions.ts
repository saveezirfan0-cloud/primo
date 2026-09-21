"use server";

import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase/server";
import { saveProcessedJob } from "@/lib/ingest/save";
import type { ProcessedJob } from "@/lib/ingest/types";

export async function confirmDocument(formData: FormData) {
  const id = String(formData.get("document_id") ?? "");
  const isHoldout = formData.get("is_holdout") === "on";
  const db = supabaseAdmin();
  const { data: doc, error } = await db.from("documents").select("id, status, extraction").eq("id", id).single();
  if (error || !doc) throw new Error("Document not found.");
  if (doc.status === "confirmed") redirect("/library");
  const extraction = doc.extraction as { processed?: ProcessedJob } | null;
  if (!extraction?.processed) throw new Error("This document has no extraction to save.");
  const jobId = await saveProcessedJob(extraction.processed, { documentId: id, isHoldout });
  redirect(`/jobs/${jobId}`);
}

export async function discardDocument(formData: FormData) {
  const id = String(formData.get("document_id") ?? "");
  await supabaseAdmin().from("documents").update({ status: "discarded" }).eq("id", id);
  redirect("/upload");
}
