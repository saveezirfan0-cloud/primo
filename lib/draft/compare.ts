import type { KJob } from "@/lib/knowledge/types";
import type { Draft } from "./types";
import { r2 } from "./totals";
import { equipmentLeaves } from "@/lib/knowledge/derive";

export type SectionCompare = {
  name: string;
  draft: number | null;
  actual: number | null;
  delta: number | null;
  pct: number | null;
  groups: Array<{ grp: string; draft: number; actual: number; delta: number; pct: number | null }>;
};

export type Comparison = {
  job_number: string;
  job_title: string;
  sections: SectionCompare[];
  subtotal: { draft: number; actual: number; delta: number; pct: number };
  hours: { draft: number; actual: number | null };
  missing: Array<{ section: string; description: string; part_number: string | null; total: number }>; // in actual, not in draft
  extra: Array<{ section: string; description: string; part_number: string | null; total: number }>; // in draft, not in actual
};

function key(name: string): string {
  const n = name.toLowerCase();
  for (const k of ["video", "audio", "control"]) if (n.includes(k)) return k;
  const m = /stage\s*(\d+)/.exec(n);
  return m ? `stage${m[1]}` : n;
}

function tokens(s: string): Set<string> {
  return new Set(s.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length > 2));
}
function similar(a: string, b: string): boolean {
  const ta = tokens(a);
  const tb = tokens(b);
  if (ta.size === 0 || tb.size === 0) return false;
  const inter = [...ta].filter((t) => tb.has(t)).length;
  return inter / Math.min(ta.size, tb.size) >= 0.5;
}

function actualGroups(section: KJob["sections"][number]) {
  const parents = new Set(section.lines.filter((l) => l.parent_id).map((l) => l.parent_id!));
  const leaves = section.lines.filter((l) => !parents.has(l.id));
  const byGrp = (g: string) => r2(leaves.filter((l) => l.grp === g).reduce((a, l) => a + (l.total ?? 0), 0));
  // Non-expanded jobs keep roll-ups as leaves, expanded ones have children; both sum correctly by grp.
  return { EQUIPMENT: byGrp("EQUIPMENT"), CABLING: byGrp("CABLING"), CONS: byGrp("CONS"), FREIGHT: byGrp("FREIGHT"), SERVICES: byGrp("SERVICES") };
}

/** Draft vs Actual for a holdout job: section deltas, group deltas, missing/extra equipment, hours. */
export function compareDraft(draft: Draft, actual: KJob): Comparison {
  const sections: SectionCompare[] = [];
  const used = new Set<string>();
  for (const ds of draft.sections) {
    const as = actual.sections.find((s) => key(s.name) === key(ds.name) && !used.has(s.id)) ?? (actual.sections.length === 1 ? actual.sections[0] : undefined);
    if (as) used.add(as.id);
    const actualTotal = as ? (as.total ?? 0) : null;
    const ag = as ? actualGroups(as) : null;
    const groups = (["EQUIPMENT", "CABLING", "CONS", "FREIGHT", "SERVICES"] as const).map((g) => {
      const d = ds.totals[g.toLowerCase() as keyof typeof ds.totals] as number;
      const a = ag ? ag[g] : 0;
      return { grp: g, draft: d, actual: a, delta: r2(d - a), pct: a ? r2(((d - a) / a) * 100) : null };
    });
    sections.push({ name: ds.name, draft: ds.totals.total, actual: actualTotal, delta: actualTotal === null ? null : r2(ds.totals.total - actualTotal), pct: actualTotal ? r2(((ds.totals.total - actualTotal) / actualTotal) * 100) : null, groups });
  }
  for (const as of actual.sections.filter((s) => !used.has(s.id))) {
    sections.push({ name: as.name, draft: null, actual: as.total ?? 0, delta: null, pct: null, groups: [] });
  }

  const actualSubtotal = r2(actual.subtotal_ex_gst ?? actual.sections.reduce((a, s) => a + (s.total ?? 0), 0));
  const subtotal = { draft: draft.totals.subtotal, actual: actualSubtotal, delta: r2(draft.totals.subtotal - actualSubtotal), pct: actualSubtotal ? r2(((draft.totals.subtotal - actualSubtotal) / actualSubtotal) * 100) : 0 };

  const draftEq = draft.sections.flatMap((s) => s.lines.filter((l) => l.grp === "EQUIPMENT" && !l.is_existing).map((l) => ({ section: s.name, description: l.description, part_number: l.part_number, total: l.total })));
  const actualEq = actual.sections.flatMap((s) => equipmentLeaves(s).map((l) => ({ section: s.name, description: l.description, part_number: l.part_number, total: l.total ?? 0 })));
  const matchesLine = (a: { description: string; part_number: string | null }, b: { description: string; part_number: string | null }) =>
    (a.part_number && b.part_number && a.part_number.toLowerCase() === b.part_number.toLowerCase()) || similar(a.description, b.description);
  const missing = actualEq.filter((a) => !draftEq.some((d) => matchesLine(a, d)));
  const extra = draftEq.filter((d) => !actualEq.some((a) => matchesLine(a, d)));

  const actualHours = actual.has_labour_detail ? r2(actual.sections.flatMap((s) => s.lines).reduce((a, l) => a + (l.hours ?? 0), 0)) : null;
  return { job_number: actual.job_number, job_title: actual.title, sections, subtotal, hours: { draft: draft.totals.hours, actual: actualHours }, missing, extra };
}
