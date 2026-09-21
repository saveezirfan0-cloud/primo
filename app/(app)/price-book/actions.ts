"use server";

import { revalidatePath } from "next/cache";
import { rebuildKnowledge } from "@/lib/knowledge/rebuild";

export async function rebuildKnowledgeAction(): Promise<{ ok: boolean; message: string }> {
  try {
    const r = await rebuildKnowledge();
    revalidatePath("/price-book");
    revalidatePath("/library");
    const base = `Rebuilt: ${r.parts} parts, ${r.labour_standards} labour standards, ${r.section_profiles} section profiles.`;
    const emb =
      r.embeddings === "skipped"
        ? " Embeddings skipped (no VOYAGE_API_KEY); matching uses keywords."
        : r.embeddings === "failed"
          ? ` ${r.embedded} job(s) embedded before Voyage refused: ${r.embedding_error?.slice(0, 160)}. Click again to continue; jobs already embedded are kept.`
          : ` ${r.embedded} job(s) newly embedded.`;
    return { ok: r.embeddings !== "failed", message: base + emb };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Rebuild failed." };
  }
}
