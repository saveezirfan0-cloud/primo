import "server-only";
import { supabaseAdmin } from "@/lib/supabase/server";
import type { KJob } from "./types";

function num(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function parseEmbedding(v: unknown): number[] | null {
  if (!v) return null;
  if (Array.isArray(v)) return v.map(Number);
  if (typeof v === "string") {
    try {
      const arr = JSON.parse(v);
      return Array.isArray(arr) ? arr.map(Number) : null;
    } catch {
      return null;
    }
  }
  return null;
}

/** Load active jobs (all revisions superseded ones excluded) with sections and lines. */
export async function loadJobs(opts: { includeHoldout?: boolean; jobNumbers?: string[] } = {}): Promise<KJob[]> {
  const db = supabaseAdmin();
  let q = db.from("jobs").select("*").eq("status", "active");
  if (!opts.includeHoldout) q = q.eq("is_holdout", false);
  if (opts.jobNumbers?.length) q = q.in("job_number", opts.jobNumbers);
  const { data: jobs, error } = await q.order("job_number");
  if (error) throw new Error(`jobs: ${error.message}`);
  if (!jobs?.length) return [];

  const ids = jobs.map((j) => j.id);
  const { data: sections, error: sErr } = await db.from("sections").select("*").in("job_id", ids).order("sort");
  if (sErr) throw new Error(`sections: ${sErr.message}`);
  const sectionIds = (sections ?? []).map((s) => s.id);
  const { data: lines, error: lErr } = sectionIds.length
    ? await db.from("line_items").select("*").in("section_id", sectionIds).order("sort")
    : { data: [], error: null };
  if (lErr) throw new Error(`line_items: ${lErr.message}`);

  return jobs.map((j) => ({
    id: j.id,
    job_number: j.job_number,
    revision: j.revision,
    title: j.title,
    client_org: j.client_org,
    site_suburb: j.site_suburb,
    issued_on: j.issued_on,
    structure: j.structure,
    room_type: j.room_type,
    install_type: j.install_type,
    subtotal_ex_gst: num(j.subtotal_ex_gst),
    params: (j.params ?? {}) as Record<string, unknown>,
    scope_text: j.scope_text,
    assumptions: j.assumptions ?? [],
    exclusions: j.exclusions ?? [],
    has_labour_detail: j.has_labour_detail,
    is_holdout: j.is_holdout,
    embedding: parseEmbedding(j.embedding),
    sections: (sections ?? [])
      .filter((s) => s.job_id === j.id)
      .map((s) => ({
        id: s.id,
        name: s.name,
        kind: s.kind,
        sort: s.sort,
        total: num(s.total),
        lines: (lines ?? [])
          .filter((l) => l.section_id === s.id)
          .map((l) => ({
            id: l.id,
            parent_id: l.parent_id,
            grp: l.grp,
            code: l.code,
            part_number: l.part_number,
            description: l.description,
            qty: Number(l.qty),
            unit_price: num(l.unit_price),
            total: num(l.total),
            is_existing: l.is_existing,
            activity: l.activity,
            hours: num(l.hours),
            rate: num(l.rate),
            sort: l.sort,
          })),
      })),
  }));
}
