import type { MatchResult } from "@/lib/match/score";
import type { Spec } from "@/lib/schemas/spec";

export type Basis = "price_book" | "matched_job" | "rate_card" | "ratio_estimate" | "ai_guess";
export type Confidence = "high" | "medium" | "low";

export type DraftLine = {
  id: string;
  section_ref: string;
  grp: "EQUIPMENT" | "CABLING" | "CONS" | "FREIGHT" | "SERVICES";
  part_number: string | null;
  description: string;
  qty: number;
  unit_price: number;
  total: number;
  is_existing: boolean;
  activity: string | null;
  hours: number | null;
  rate: number | null;
  basis: Basis;
  source_job_number: string | null;
  confidence: Confidence;
  note: string;
  component_ref: string | null;
};

export type SectionTotals = { equipment: number; cabling: number; cons: number; freight: number; services: number; total: number };

export type DraftSection = {
  ref: string;
  name: string;
  kind: string;
  template: { job_number: string; section_name: string } | null;
  lines: DraftLine[];
  totals: SectionTotals;
};

export type DraftText = { scope_paragraphs: string[]; assumptions: string[]; exclusions: string[] };

export type Draft = {
  sections: DraftSection[];
  totals: { subtotal: number; gst: number; total: number; hours: number };
  matches: MatchResult[];
  rate_card: Array<{ code: string; rate: number | null; unit: string }>;
  ratio_sources: Array<{ section: string; template: string; cabling_ratio: number; cons_ratio: number; freight_ratio: number; services_ratio: number }>;
  text: DraftText;
  warnings: string[];
  generated_at: string;
};

export type EstimateRecord = {
  id: string;
  brief_text: string;
  spec: Spec | null;
  matches: MatchResult[] | null;
  draft: Draft | null;
  compare_job_number: string | null;
  created_at: string;
};
