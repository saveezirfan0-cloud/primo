import { randomUUID } from "node:crypto";
import type { ExtractedJob } from "@/lib/schemas/extraction";
import type { ProcessedJob, ProcessedLine, ProcessedSection, RateCardEntry } from "./types";
import { buildSectionTree, leafSum, rollupCode } from "./tree";
import { deriveHours, tagActivities } from "./labour";
import { validate } from "./validate";
import { cents } from "./money";

/**
 * Deterministic post-processing of an extraction:
 * tree inference -> activity tagging -> hour derivation -> validation.
 */
export function processExtraction(extracted: ExtractedJob, rateCard: RateCardEntry[]): ProcessedJob {
  const lines: ProcessedLine[] = [];
  const sections: ProcessedSection[] = [];
  let sort = 0;

  for (const section of extracted.sections) {
    const rows = extracted.line_items.filter((l) => l.section_ref === section.ref);
    const tree = buildSectionTree(rows);
    const ls = leafSum(tree);
    sections.push({ ref: section.ref, name: section.name, kind: section.kind, total: section.total, leaf_sum: ls });

    const parents = new Set(tree.filter((r) => r.parent_ref).map((r) => r.parent_ref!));
    const byRef = new Map(tree.map((r) => [r.ref, r]));
    for (const row of tree) {
      let depth = 0;
      let p = row.parent_ref;
      while (p && depth < 10) {
        depth += 1;
        p = byRef.get(p)?.parent_ref ?? null;
      }
      const isExisting = (row.part_number ?? "").trim().toUpperCase() === "OFE";
      lines.push({
        id: randomUUID(),
        ref: row.ref,
        parent_ref: row.parent_ref,
        section_ref: row.section_ref,
        grp: row.grp,
        code: rollupCode(row),
        part_number: row.part_number?.trim() || null,
        description: row.description.trim(),
        qty: row.qty,
        unit_price: row.unit_price,
        total: row.total === null ? null : cents(row.total),
        is_existing: isExisting,
        activity: null,
        hours: null,
        rate: null,
        sort: sort++,
        depth,
        is_leaf: !parents.has(row.ref),
      });
    }
  }

  tagActivities(lines);
  for (const line of lines) deriveHours(line, rateCard);

  const has_labour_detail = lines.some((l) => l.activity && l.is_leaf && l.parent_ref);
  const validation = validate(sections, lines, extracted.summary);

  return {
    header: extracted.header,
    summary: extracted.summary,
    params: extracted.params,
    sections,
    lines,
    optional_items: extracted.optional_items,
    scope_text: extracted.scope_paragraphs.join("\n\n"),
    assumptions: extracted.assumptions,
    exclusions: extracted.exclusions,
    has_labour_detail,
    validation,
  };
}
