import type { ExtractedJob } from "@/lib/schemas/extraction";
import type { ParentMismatch, ProcessedLine, ProcessedSection, SectionValidation, ValidationReport } from "./types";
import { cents, sum, TOLERANCE, within } from "./money";
import { norm } from "./tree";

/**
 * Arithmetic validation: leaves -> parents -> section totals -> subtotal -> GST.
 * Tolerances: ~$1 per line, ~$5 per section (CLAUDE.md).
 */
export function validate(
  sections: ProcessedSection[],
  lines: ProcessedLine[],
  summary: ExtractedJob["summary"],
): ValidationReport {
  const messages: string[] = [];
  const byRef = new Map(lines.map((l) => [l.ref, l]));

  const sectionReports: SectionValidation[] = sections.map((s) => {
    const rows = lines.filter((l) => l.section_ref === s.ref);
    const parents = new Map<string, ProcessedLine[]>();
    for (const r of rows) {
      if (!r.parent_ref) continue;
      const arr = parents.get(r.parent_ref) ?? [];
      arr.push(r);
      parents.set(r.parent_ref, arr);
    }
    const parent_mismatches: ParentMismatch[] = [];
    for (const [ref, kids] of parents) {
      const p = byRef.get(ref);
      if (!p) continue;
      const children_sum = sum(kids.map((k) => k.total));
      if (!within(p.total, children_sum, TOLERANCE.line)) {
        parent_mismatches.push({
          ref,
          description: p.description,
          total: p.total,
          children_sum,
          delta: cents((p.total ?? 0) - children_sum),
        });
      }
    }

    const summaryRow = summary.sections.find((x) => norm(x.name) === norm(s.name));
    const summary_total = summaryRow && summaryRow.total !== 0 ? summaryRow.total : null;
    const delta_vs_bom = typeof s.total === "number" ? cents(s.leaf_sum - s.total) : null;
    const delta_vs_summary = typeof summary_total === "number" ? cents(s.leaf_sum - summary_total) : null;

    const declared = s.total ?? summary_total;
    const ok =
      parent_mismatches.length === 0 &&
      typeof declared === "number" &&
      within(s.leaf_sum, declared, TOLERANCE.section) &&
      (summary_total === null || s.total === null || within(s.total, summary_total, TOLERANCE.section));

    if (!ok) {
      if (parent_mismatches.length) messages.push(`${s.name}: ${parent_mismatches.length} roll-up row(s) do not equal the sum of their children.`);
      if (typeof declared !== "number") messages.push(`${s.name}: no section total found in the BOM or Summary Pricing.`);
      else if (!within(s.leaf_sum, declared, TOLERANCE.section)) messages.push(`${s.name}: lines sum to ${s.leaf_sum.toFixed(2)} but the section total is ${declared.toFixed(2)} (delta ${cents(s.leaf_sum - declared).toFixed(2)}).`);
    }

    return { ref: s.ref, name: s.name, bom_total: s.total, summary_total, leaf_sum: s.leaf_sum, delta_vs_bom, delta_vs_summary, parent_mismatches, ok };
  });

  const sections_sum = sum(sections.map((s) => s.total ?? s.leaf_sum));
  const leaf_sum = sum(sections.map((s) => s.leaf_sum));
  const declared = summary.subtotal_ex_gst !== 0 ? summary.subtotal_ex_gst : null;
  const subtotalOk = typeof declared === "number" && within(sections_sum, declared, TOLERANCE.section) && within(leaf_sum, declared, TOLERANCE.section * Math.max(1, sections.length));
  if (!subtotalOk) {
    if (typeof declared !== "number") messages.push("No subtotal ex GST found in Summary Pricing.");
    else messages.push(`Sections sum to ${sections_sum.toFixed(2)} (lines ${leaf_sum.toFixed(2)}) but the subtotal is ${declared.toFixed(2)}.`);
  }

  const expectedGst = typeof declared === "number" ? cents(declared * 0.1) : null;
  const gstOk = summary.gst === 0 || expectedGst === null || within(summary.gst, expectedGst, 1);
  if (!gstOk) messages.push(`GST ${summary.gst} does not equal 10% of the subtotal (${expectedGst}).`);

  const ok = sectionReports.every((s) => s.ok) && subtotalOk && gstOk;
  return {
    ok,
    tolerance: { ...TOLERANCE },
    sections: sectionReports,
    subtotal: { declared, sections_sum, leaf_sum, delta: typeof declared === "number" ? cents(sections_sum - declared) : null, ok: subtotalOk },
    gst: { declared: summary.gst, expected: expectedGst, ok: gstOk },
    messages,
  };
}
