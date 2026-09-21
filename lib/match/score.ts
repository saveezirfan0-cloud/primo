import type { KJob } from "@/lib/knowledge/types";
import { cosine } from "@/lib/knowledge/embeddings";
import { categorise } from "@/lib/knowledge/categories";
import { equipmentLeaves } from "@/lib/knowledge/derive";

/** The subset of a spec the matcher needs. */
export type MatchSpec = {
  room_type: string | null;
  params: Record<string, unknown>;
  /** categories of components the brief asks for (new items) */
  categories: string[];
  /** query embedding of the brief, if available */
  embedding: number[] | null;
  /** lowercase keywords from the brief for the text fallback */
  keywords: string[];
};

export type MatchResult = {
  job_number: string;
  revision: number;
  title: string;
  score: number;
  score_params: number;
  score_vector: number;
  score_parts: number;
  reasons: string[];
};

/** Weights per param: how much each cost driver matters for similarity. */
const PARAM_WEIGHTS: Record<string, number> = {
  install_type: 1.5,
  staged: 1,
  projectors_new: 2,
  projector_lumens: 1,
  screens_new: 1,
  screens_retained: 0.5,
  speakers_new: 2,
  speakers_retained: 0.5,
  amp_channels_new: 1,
  wireless_mic_channels: 1.5,
  wired_mics: 0.5,
  dsp_new: 1,
  dante: 1,
  stage_io: 0.5,
  touch_panels: 1.5,
  control_processor: 0.5,
  video_inputs: 1,
  wireless_presentation: 1,
  rack: 1,
  hearing_augmentation: 0.5,
  lighting_integration: 1,
  recording_streaming: 0.5,
  ewp_required: 0.5,
};

function paramSimilarity(a: unknown, b: unknown): number | null {
  if (a === null || a === undefined || b === null || b === undefined) return null;
  if (typeof a === "boolean" || typeof b === "boolean") return a === b ? 1 : 0;
  if (typeof a === "number" && typeof b === "number") {
    if (a === b) return 1;
    const max = Math.max(Math.abs(a), Math.abs(b));
    return max === 0 ? 1 : Math.max(0, 1 - Math.abs(a - b) / max);
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    const sa = new Set(a.map(String));
    const sb = new Set(b.map(String));
    const inter = [...sa].filter((x) => sb.has(x)).length;
    const union = new Set([...sa, ...sb]).size;
    return union === 0 ? 1 : inter / union;
  }
  return String(a).toLowerCase() === String(b).toLowerCase() ? 1 : 0;
}

export const WEIGHTS = { params: 0.5, vector: 0.3, parts: 0.2 } as const;

export function scoreJobs(spec: MatchSpec, jobs: KJob[], limit = 3): MatchResult[] {
  // room_type as a filter when it leaves candidates; otherwise fall back to everything.
  const filtered = spec.room_type ? jobs.filter((j) => j.room_type === spec.room_type) : jobs;
  const candidates = filtered.length ? filtered : jobs;
  const hasVectors = Boolean(spec.embedding) && candidates.some((j) => j.embedding);

  const results = candidates.map((job) => {
    const reasons: string[] = [];

    // params
    let wsum = 0;
    let acc = 0;
    const hits: string[] = [];
    const misses: string[] = [];
    for (const [key, w] of Object.entries(PARAM_WEIGHTS)) {
      const s = paramSimilarity(spec.params[key], job.params[key]);
      if (s === null) continue;
      wsum += w;
      acc += w * s;
      if (s >= 0.99) hits.push(key);
      else if (s <= 0.01 && w >= 1) misses.push(key);
    }
    const score_params = wsum ? acc / wsum : 0;
    if (hits.length) reasons.push(`Matches on ${hits.slice(0, 6).map((k) => k.replace(/_/g, " ")).join(", ")}${hits.length > 6 ? ` +${hits.length - 6} more` : ""}`);
    if (misses.length) reasons.push(`Differs on ${misses.slice(0, 4).map((k) => k.replace(/_/g, " ")).join(", ")}`);

    // vector (or keyword fallback)
    let score_vector = 0;
    if (hasVectors && spec.embedding && job.embedding) {
      score_vector = Math.max(0, cosine(spec.embedding, job.embedding));
      reasons.push(`Scope similarity ${(score_vector * 100).toFixed(0)}%`);
    } else if (spec.keywords.length) {
      const hay = `${job.title} ${job.scope_text ?? ""}`.toLowerCase();
      const found = spec.keywords.filter((k) => hay.includes(k));
      score_vector = found.length / spec.keywords.length;
      if (found.length) reasons.push(`Scope mentions ${found.slice(0, 5).join(", ")}`);
    }

    // parts / category overlap
    const jobCats = new Set(job.sections.flatMap((s) => equipmentLeaves(s).map((l) => categorise(l.description, l.part_number))));
    const wanted = new Set(spec.categories);
    const overlap = [...wanted].filter((c) => jobCats.has(c));
    const score_parts = wanted.size ? overlap.length / wanted.size : 0;
    if (overlap.length) reasons.push(`Has priced ${overlap.slice(0, 5).map((c) => c.replace(/_/g, " ")).join(", ")} (${overlap.length}/${wanted.size} categories)`);

    if (spec.room_type && job.room_type === spec.room_type) reasons.unshift(`Same room type (${job.room_type})`);
    if (job.has_labour_detail) reasons.push("Has per-item labour detail");

    const score = WEIGHTS.params * score_params + WEIGHTS.vector * score_vector + WEIGHTS.parts * score_parts;
    return { job_number: job.job_number, revision: job.revision, title: job.title, score: r3(score), score_params: r3(score_params), score_vector: r3(score_vector), score_parts: r3(score_parts), reasons };
  });

  return results.sort((a, b) => b.score - a.score).slice(0, limit);
}

function r3(n: number) {
  return Math.round(n * 1000) / 1000;
}

/** Keywords for the text fallback: distinctive lowercase tokens from the brief. */
export function briefKeywords(brief: string): string[] {
  const stop = new Set(["the", "and", "with", "for", "one", "two", "three", "new", "existing", "keep", "add", "into", "onto", "from", "that", "this", "school", "hall", "upgrade", "replace", "old", "small", "needed", "reuse", "so", "can", "it"]);
  return [...new Set(brief.toLowerCase().replace(/[^a-z0-9\s-]/g, " ").split(/\s+/).filter((w) => w.length > 3 && !stop.has(w)))].slice(0, 40);
}
