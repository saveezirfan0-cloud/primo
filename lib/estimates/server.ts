import "server-only";
import { supabaseAdmin } from "@/lib/supabase/server";
import { loadJobs } from "@/lib/knowledge/from-db";
import { loadRateCard } from "@/lib/ingest/rate-card";
import { embed, embeddingsEnabled } from "@/lib/knowledge/embeddings";
import type { DraftContext } from "@/lib/draft/context";
import type { LabourStandard, PartRecord, SectionProfile } from "@/lib/knowledge/types";
import type { MatchResult } from "@/lib/match/score";
import type { Spec } from "@/lib/schemas/spec";
import type { Draft, EstimateRecord } from "@/lib/draft/types";
import { parseBrief, matchSpec, generateDraft } from "@/lib/draft/pipeline";
import { briefKeywords } from "@/lib/match/score";
import type { Json } from "@/lib/supabase/types";

async function queryEmbedding(text: string): Promise<number[] | null> {
  if (!embeddingsEnabled()) return null;
  try {
    const v = await embed([text], "query");
    return v?.[0] ?? null;
  } catch {
    return null;
  }
}

export async function createEstimateFromBrief(brief: string): Promise<string> {
  const db = supabaseAdmin();
  const library = await loadJobs();
  const qe = await queryEmbedding(brief);
  const { spec, matches } = await parseBrief(brief, library, qe);
  const { data, error } = await db
    .from("estimates")
    .insert({ brief_text: brief, spec: spec as unknown as Json, matches: matches as unknown as Json })
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Could not save estimate.");
  return data.id;
}

export async function getEstimate(id: string): Promise<EstimateRecord | null> {
  const { data } = await supabaseAdmin().from("estimates").select("*").eq("id", id).single();
  if (!data) return null;
  return {
    id: data.id,
    brief_text: data.brief_text,
    spec: (data.spec as unknown as Spec) ?? null,
    matches: (data.matches as unknown as MatchResult[]) ?? null,
    draft: (data.draft as unknown as Draft) ?? null,
    compare_job_number: data.compare_job_number,
    created_at: data.created_at,
  };
}

export async function saveSpec(id: string, spec: Spec): Promise<MatchResult[]> {
  const db = supabaseAdmin();
  const { data: row } = await db.from("estimates").select("brief_text").eq("id", id).single();
  const library = await loadJobs();
  const qe = row ? await queryEmbedding(row.brief_text) : null;
  const matches = matchSpec(spec, library, qe, row ? briefKeywords(row.brief_text) : []);
  const { error } = await db.from("estimates").update({ spec: spec as unknown as Json, matches: matches as unknown as Json, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw new Error(error.message);
  return matches;
}

export async function loadDraftContext(matches: MatchResult[]): Promise<DraftContext> {
  const db = supabaseAdmin();
  const [parts, standards, profiles, rateCard, matchedJobs, labourJobs] = await Promise.all([
    db.from("parts").select("*"),
    db.from("labour_standards").select("*"),
    db.from("section_profiles").select("*"),
    loadRateCard(),
    loadJobs({ jobNumbers: matches.map((m) => m.job_number) }),
    db.from("jobs").select("job_number").eq("status", "active").eq("is_holdout", false).eq("has_labour_detail", true).order("job_number"),
  ]);
  if (parts.error) throw new Error(parts.error.message);
  if (standards.error) throw new Error(standards.error.message);
  if (profiles.error) throw new Error(profiles.error.message);
  const order = new Map(matches.map((m, i) => [m.job_number, i]));
  return {
    parts: (parts.data ?? []).map<PartRecord>((p) => ({ part_number: p.part_number, description: p.description ?? "", brand: p.brand, category: p.category ?? "other", last_price: Number(p.last_price ?? 0), last_seen: p.last_seen, times_used: p.times_used, jobs: p.jobs ?? [] })),
    standards: (standards.data ?? []).map<LabourStandard>((s) => ({ part_number: s.part_number, category: s.category, activity: s.activity, hours: Number(s.hours), amount: s.amount === null ? null : Number(s.amount), sample_count: s.sample_count })),
    profiles: (profiles.data ?? []).map<SectionProfile>((p) => ({ job_number: p.job_number, job_title: p.job_title, section_name: p.section_name, section_kind: p.section_kind, section_total: Number(p.section_total), equipment_value: Number(p.equipment_value), cabling: Number(p.cabling), cons: Number(p.cons), freight: Number(p.freight), services: Number(p.services), activities: (p.activities ?? {}) as SectionProfile["activities"], categories: p.categories ?? [] })),
    rateCard,
    matches,
    matchedJobs: matchedJobs.sort((a, b) => (order.get(a.job_number) ?? 9) - (order.get(b.job_number) ?? 9)),
    labourSourceJobs: [...new Set((labourJobs.data ?? []).map((j) => j.job_number))],
  };
}

export async function generateAndSaveDraft(id: string): Promise<Draft> {
  const est = await getEstimate(id);
  if (!est?.spec) throw new Error("Estimate has no spec.");
  const matches = est.matches ?? [];
  const ctx = await loadDraftContext(matches);
  const draft = await generateDraft(est.spec, ctx);
  const { error } = await supabaseAdmin().from("estimates").update({ draft: draft as unknown as Json, totals: draft.totals as unknown as Json, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw new Error(error.message);
  return draft;
}

export async function saveDraft(id: string, draft: Draft, compareJobNumber: string | null): Promise<void> {
  const { error } = await supabaseAdmin()
    .from("estimates")
    .update({ draft: draft as unknown as Json, totals: draft.totals as unknown as Json, compare_job_number: compareJobNumber, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
}
