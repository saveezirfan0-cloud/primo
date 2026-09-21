import "server-only";
import { supabaseAdmin } from "@/lib/supabase/server";
import { loadJobs } from "./from-db";
import { derivePriceBook, deriveLabourStandards, deriveSectionProfiles, jobEmbeddingText } from "./derive";
import { embed, embeddingsEnabled } from "./embeddings";

export type RebuildReport = { parts: number; labour_standards: number; section_profiles: number; embedded: number; embeddings: "voyage" | "skipped" };

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

  let embedded = 0;
  if (embeddingsEnabled()) {
    const vectors = await embed(jobs.map((j) => jobEmbeddingText(j)), "document");
    if (vectors) {
      for (let i = 0; i < jobs.length; i++) {
        const { error } = await db.from("jobs").update({ embedding: JSON.stringify(vectors[i]) }).eq("id", jobs[i].id);
        if (error) throw new Error(`embedding update: ${error.message}`);
        embedded += 1;
      }
    }
  }
  return { parts: parts.length, labour_standards: standards.length, section_profiles: profiles.length, embedded, embeddings: embeddingsEnabled() ? "voyage" : "skipped" };
}
