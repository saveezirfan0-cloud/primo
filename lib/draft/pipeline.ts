import type { KJob } from "@/lib/knowledge/types";
import type { DraftContext } from "./context";
import { briefToSpec } from "./spec";
import { choosePartsForComponents } from "./parts";
import { buildDraft } from "./build";
import { draftText } from "./text";
import { scoreJobs, briefKeywords, type MatchResult } from "@/lib/match/score";
import { specParams, type Spec } from "@/lib/schemas/spec";
import type { Draft } from "./types";

/**
 * Step 1: brief -> matches -> spec. Matching runs twice: a cheap keyword pass to
 * pick reference jobs for the parser, then a full pass on the parsed params.
 */
export async function parseBrief(brief: string, libraryJobs: KJob[], queryEmbedding: number[] | null): Promise<{ spec: Spec; matches: MatchResult[] }> {
  const keywords = briefKeywords(brief);
  const pre = scoreJobs({ room_type: null, params: {}, categories: [], embedding: queryEmbedding, keywords }, libraryJobs, 3);
  const refJobs = pre.map((m) => libraryJobs.find((j) => j.job_number === m.job_number)!).filter(Boolean);
  const spec = await briefToSpec(brief, refJobs);
  const matches = matchSpec(spec, libraryJobs, queryEmbedding, keywords);
  return { spec, matches };
}

export function matchSpec(spec: Spec, libraryJobs: KJob[], queryEmbedding: number[] | null, keywords: string[] = []): MatchResult[] {
  const params = specParams(spec) as unknown as Record<string, unknown>;
  const categories = [...new Set(spec.components.filter((c) => c.status === "new").map((c) => c.category))];
  return scoreJobs({ room_type: spec.room_type, params, categories, embedding: queryEmbedding, keywords }, libraryJobs, 3);
}

/** Step 2: spec -> priced draft -> text. */
export async function generateDraft(spec: Spec, ctx: DraftContext, opts: { withText?: boolean } = {}): Promise<Draft> {
  const choices = await choosePartsForComponents(spec, ctx.parts);
  const draft = buildDraft(spec, ctx, choices);
  if (opts.withText !== false) {
    const { text, warnings } = await draftText(spec, draft, ctx.matchedJobs);
    draft.text = text;
    draft.warnings.push(...warnings);
  }
  return draft;
}
