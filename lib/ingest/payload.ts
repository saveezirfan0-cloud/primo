import { randomUUID } from "node:crypto";
import type { ProcessedJob } from "./types";

/** Payload for the save_job SQL function. Pure: no DB access, usable from scripts. */
export function buildSavePayload(job: ProcessedJob, opts: { documentId?: string | null; isHoldout?: boolean } = {}) {
  const sectionIds = new Map(job.sections.map((s) => [s.ref, randomUUID()]));
  const lineIds = new Map(job.lines.map((l) => [l.ref, l.id]));
  return {
    job_number: job.header.job_number,
    title: job.header.title,
    client_org: job.header.client_org,
    site_suburb: job.header.site_suburb,
    issued_on: job.header.issued_on,
    structure: job.header.structure,
    room_type: job.params.room_type,
    install_type: job.params.install_type,
    subtotal_ex_gst: job.summary.subtotal_ex_gst,
    params: job.params,
    scope_text: job.scope_text,
    assumptions: job.assumptions,
    exclusions: job.exclusions,
    has_labour_detail: job.has_labour_detail,
    is_holdout: opts.isHoldout ?? false,
    document_id: opts.documentId ?? null,
    sections: job.sections.map((s, i) => ({ id: sectionIds.get(s.ref), name: s.name, kind: s.kind, sort: i, total: s.total })),
    lines: job.lines.map((l) => ({
      id: l.id,
      section_id: sectionIds.get(l.section_ref),
      parent_id: l.parent_ref ? (lineIds.get(l.parent_ref) ?? null) : null,
      grp: l.grp,
      code: l.code,
      part_number: l.part_number,
      description: l.description,
      qty: l.qty,
      unit_price: l.unit_price,
      total: l.total,
      is_existing: l.is_existing,
      activity: l.activity,
      hours: l.hours,
      rate: l.rate,
      sort: l.sort,
    })),
    optional_items: job.optional_items,
  };
}
