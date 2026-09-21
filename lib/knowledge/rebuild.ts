import "server-only";
import { supabaseAdmin } from "@/lib/supabase/server";
import { loadJobs } from "./from-db";
import { derivePriceBook, deriveLabourStandards, deriveSectionProfiles, jobEmbeddingText } from "./derive";
import { embed, embeddingsEnabled } from "./embeddings";

export type RebuildReport = { parts: number; labour_standards: number; section_profiles: number; embedded: number; embeddings: "voyage" | "skipped" | "failed"; embedding_error?: string };

/** Recompute the price book, labour standards, section profiles and (if configured) embeddings from the library. */
export async function rebuildKnowledge(): Promise<RebuildReport> {
  const db = supabaseAdmin();
  const jobs = await loadJobs({ includeHoldout: true });

  const parts = derivePriceBook(jobs);
  const standards = deriveLabourStandards(jobs);
  const profiles = deriveSectionProfiles(jobs);

  // parts: replace
  {
    const { error } = await db.from("labour_standards").delete().not("part_number", "is", null);
    if (error) throw new Error(`labour_standards clear: ${error.message}`);
  }
  {
    const { error } = await db.from("parts").delete().neq("part_number", "");
    if (error) throw new Error(`parts clear: ${error.message}`);
  }
  if (parts.length) {
    const { error } = await db.from("parts").upsert(parts.map((p) => ({ ...p, updated_at: new Date().toISOString() })), { onConflict: "part_number" });
    if (error) throw new Error(`parts upsert: ${error.message}`);
  }
  {
    const { error } = await db.from("labour_standards").delete().is("part_number", null);
    if (error) throw new Error(`labour_standards clear: ${error.message}`);
  }
  if (standards.length) {
    const { error } = await db.from("labour_standards").insert(standards.map((s) => ({ ...s, updated_at: new Date().toISOString() })));
    if (error) throw new Error(`labour_standards insert: ${error.message}`);
  }
  {
    const { error } = await db.from("section_profiles").delete().neq("job_number", "");
    if (error) throw new Error(`section_profiles clear: ${error.message}`);
  }
  if (profiles.length) {
    const { error } = await db.from("section_profiles").insert(profiles.map((p) => ({ ...p, updated_at: new Date().toISOString() })));
    if (error) throw new Error(`section_profiles insert: ${error.message}`);
  }

  // Embeddings are best-effort: only jobs without one are embedded, one request at a time.
  let embedded = 0;
  let embedding_error: string | undefined;
  const todo = jobs.filter((j) => !j.embedding);
  if (embeddingsEnabled() && todo.length) {
    try {
      for (const job of todo) {
        const vectors = await embed([jobEmbeddingText(job)], "document");
        if (!vectors) break;
        const { error } = await db.from("jobs").update({ embedding: JSON.stringify(vectors[0]) }).eq("id", job.id);
        if (error) throw new Error(`embedding update: ${error.message}`);
        embedded += 1;
      }
    } catch (e) {
      embedding_error = e instanceof Error ? e.message : String(e);
    }
  }
  return {
    parts: parts.length,
    labour_standards: standards.length,
    section_profiles: profiles.length,
    embedded,
    embeddings: !embeddingsEnabled() ? "skipped" : embedding_error ? "failed" : "voyage",
    embedding_error,
  };
}
