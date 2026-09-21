import type { KJob } from "./types";

type Payload = {
  job_number: string;
  title: string;
  client_org: string | null;
  site_suburb: string | null;
  issued_on: string | null;
  structure: string | null;
  room_type: string | null;
  install_type: string | null;
  subtotal_ex_gst: number | null;
  params: Record<string, unknown>;
  scope_text: string;
  assumptions: string[];
  exclusions: string[];
  has_labour_detail: boolean;
  is_holdout: boolean;
  sections: Array<{ id: string; name: string; kind: string; sort: number; total: number | null }>;
  lines: Array<{
    id: string; section_id: string; parent_id: string | null; grp: string; code: string | null; part_number: string | null;
    description: string; qty: number; unit_price: number | null; total: number | null; is_existing: boolean;
    activity: string | null; hours: number | null; rate: number | null; sort: number;
  }>;
};

/** Build a KJob from a save_job payload (seed/out/*.json). Used by scripts and tests without a database. */
export function jobFromPayload(p: Payload, embedding: number[] | null = null): KJob {
  return {
    id: `payload-${p.job_number}`,
    job_number: p.job_number,
    revision: 1,
    title: p.title,
    client_org: p.client_org,
    site_suburb: p.site_suburb,
    issued_on: p.issued_on,
    structure: p.structure,
    room_type: p.room_type,
    install_type: p.install_type,
    subtotal_ex_gst: p.subtotal_ex_gst,
    params: p.params ?? {},
    scope_text: p.scope_text,
    assumptions: p.assumptions ?? [],
    exclusions: p.exclusions ?? [],
    has_labour_detail: p.has_labour_detail,
    is_holdout: p.is_holdout,
    embedding,
    sections: p.sections.map((s) => ({
      id: s.id,
      name: s.name,
      kind: s.kind,
      sort: s.sort,
      total: s.total,
      lines: p.lines.filter((l) => l.section_id === s.id).map((l) => { const { section_id, ...rest } = l; void section_id; return rest; }),
    })),
  };
}
