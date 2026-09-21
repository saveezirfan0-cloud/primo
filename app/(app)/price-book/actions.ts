"use server";

import { revalidatePath } from "next/cache";
import { rebuildKnowledge } from "@/lib/knowledge/rebuild";

export async function rebuildKnowledgeAction(): Promise<{ ok: boolean; message: string }> {
  try {
    const r = await rebuildKnowledge();
    revalidatePath("/price-book");
    revalidatePath("/library");
    return {
      ok: true,
      message: `Rebuilt: ${r.parts} parts, ${r.labour_standards} labour standards, ${r.section_profiles} section profiles, ${r.embedded} embeddings (${r.embeddings}).`,
    };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Rebuild failed." };
  }
}
