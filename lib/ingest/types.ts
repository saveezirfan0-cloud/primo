import type { ExtractedJob, ExtractedParams, LineGroup } from "@/lib/schemas/extraction";

/** A BOM line after tree inference, labour tagging and hour derivation. */
export type ProcessedLine = {
  id: string; // client-generated uuid so parent links can be saved in one pass
  ref: string;
  parent_ref: string | null;
  section_ref: string;
  grp: LineGroup;
  code: string | null; // roll-up code (CABLING / CONS / FREIGHT / SERVICES) or activity code on roll-up rows
  part_number: string | null;
  description: string;
  qty: number;
  unit_price: number | null;
  total: number | null;
  is_existing: boolean;
  activity: string | null;
  hours: number | null;
  rate: number | null;
  sort: number;
  depth: number;
  is_leaf: boolean;
};

export type ProcessedSection = {
  ref: string;
  name: string;
  kind: "system" | "stage" | "single";
  total: number | null; // declared in the BOM
  leaf_sum: number; // computed from leaves (children replace parents)
};

export type ParentMismatch = {
  ref: string;
  description: string;
  total: number | null;
  children_sum: number;
  delta: number;
};

export type SectionValidation = {
  ref: string;
  name: string;
  bom_total: number | null;
  summary_total: number | null;
  leaf_sum: number;
  delta_vs_bom: number | null;
  delta_vs_summary: number | null;
  parent_mismatches: ParentMismatch[];
  ok: boolean;
};

export type ValidationReport = {
  ok: boolean;
  tolerance: { line: number; section: number };
  sections: SectionValidation[];
  subtotal: {
    declared: number | null;
    sections_sum: number;
    leaf_sum: number;
    delta: number | null;
    ok: boolean;
  };
  gst: { declared: number | null; expected: number | null; ok: boolean };
  messages: string[];
};

export type ProcessedJob = {
  header: ExtractedJob["header"];
  summary: ExtractedJob["summary"];
  params: ExtractedParams;
  sections: ProcessedSection[];
  lines: ProcessedLine[];
  optional_items: ExtractedJob["optional_items"];
  scope_text: string;
  assumptions: string[];
  exclusions: string[];
  has_labour_detail: boolean;
  validation: ValidationReport;
};

export type RateCardEntry = { code: string; rate: number | null; unit: string };
