/**
 * Representative slice of job 6570's expanded export (Eastwood Heights PS,
 * Video section), built from the labour figures documented in CLAUDE.md:
 * 47.55 = 0.5h, 57.06 = 0.6h, 190.20 = 2h, 9.51/m = 0.1h, 552 = 4h (ENGINEER),
 * 103.50 = 0.75h (COMMISSION), 1152 = 8h (PROGRAM), 624 = 4h (PROJECT-MANAGE),
 * DE-COMM 30.91 / 61.82 (dollar amounts). Totals are the exact sums of the leaves.
 */
import type { ExtractedJob, ExtractedLineItem } from "@/lib/schemas/extraction";

type Row = Omit<ExtractedLineItem, "section_ref" | "is_rollup" | "depth" | "grp" | "part_number" | "unit_price"> &
  Partial<Pick<ExtractedLineItem, "is_rollup" | "depth" | "grp" | "part_number" | "unit_price">>;

/** Rows default to depth 0 / EQUIPMENT; tagging derives the real group from roll-up codes and nesting. */
function rows(section: string, list: Row[]): ExtractedLineItem[] {
  return list.map((r) => ({ section_ref: section, is_rollup: false, depth: 0, grp: "EQUIPMENT", part_number: "", unit_price: 0, ...r }));
}

// Equipment
const EQUIPMENT = 8390.0 + 0 + 0 + 1240.0; // projector + OFE screen + OFE amp + bracket
// Cabling children: assemblies + per-metre + connectors + contingency
const CABLING = 380.0 + 190.2 + 96.5 + 150.0; // 816.70
const CONS = 220.0; // 2 x 110
const FREIGHT = 110.0;
// Services children
const DECOMM = 30.91 + 61.82; // 92.73
const INSTALL = 47.55 + 57.06 + 190.2; // 294.81
const CABLING_INSTALL = 190.2 + 47.55; // 237.75 (20 m at 9.51 + 0.5h)
const ENGINEER = 552.0;
const COMMISSION = 103.5;
const PROGRAM = 1152.0;
const PM = 624.0;
const SERVICES = DECOMM + INSTALL + CABLING_INSTALL + ENGINEER + COMMISSION + PROGRAM + PM; // 3056.79
export const VIDEO_TOTAL = Math.round((EQUIPMENT + CABLING + CONS + FREIGHT + SERVICES) * 100) / 100; // 13833.49

export const videoExpandedWithDepth: ExtractedLineItem[] = rows("S1", [
  { ref: "L1", description: "Epson EB-PU1007W 7,000lm laser projector", part_number: "EB-PU1007W", qty: 1, unit_price: 8390, total: 8390 },
  { ref: "L2", description: "Existing motorised screen (retained)", part_number: "OFE", qty: 1, unit_price: 0, total: 0 },
  { ref: "L3", description: "Existing amplifier (retained)", part_number: "OFE", qty: 1, unit_price: 0, total: 0 },
  { ref: "L4", description: "Projector ceiling pole and bracket", part_number: "CUSTOM", qty: 1, unit_price: 1240, total: 1240 },
  { ref: "L5", description: "Cabling", part_number: "CABLING", qty: 1, unit_price: 0, total: 816.7, is_rollup: true },
  { ref: "L6", depth: 1, description: "Cat 6A F/UTP Dual Data Outlet – 20mtrs", part_number: "CAT6A-DDO-20", qty: 2, unit_price: 190, total: 380 },
  { ref: "L7", depth: 1, description: "HDMI 2.0 active optical cable per metre", part_number: "HDMI-AOC", qty: 20, unit_price: 9.51, total: 190.2 },
  { ref: "L8", depth: 1, description: "Connectors and labels", part_number: "", qty: 1, unit_price: 96.5, total: 96.5 },
  { ref: "L9", depth: 1, description: "Contingency", part_number: "", qty: 1, unit_price: 150, total: 150 },
  { ref: "L10", description: "Hardware & Consumables", part_number: "CONS", qty: 2, unit_price: 110, total: 220, is_rollup: true },
  { ref: "L11", description: "Freight & Logistics", part_number: "FREIGHT", qty: 1, unit_price: 110, total: 110, is_rollup: true },
  { ref: "L12", description: "Services", part_number: "SERVICES", qty: 1, unit_price: 0, total: 3056.79, is_rollup: true },
  { ref: "L13", depth: 1, description: "DE-COMM", part_number: "", qty: 1, unit_price: 0, total: 92.73, is_rollup: true },
  { ref: "L14", depth: 2, description: "Decommission existing projector", part_number: "", qty: 1, unit_price: 30.91, total: 30.91 },
  { ref: "L15", depth: 2, description: "Decommission existing cabling", part_number: "", qty: 2, unit_price: 30.91, total: 61.82 },
  { ref: "L16", depth: 1, description: "INSTALL", part_number: "", qty: 1, unit_price: 0, total: 294.81, is_rollup: true },
  { ref: "L17", depth: 2, description: "Install projector bracket", part_number: "", qty: 1, unit_price: 47.55, total: 47.55 },
  { ref: "L18", depth: 2, description: "Install projector", part_number: "", qty: 1, unit_price: 57.06, total: 57.06 },
  { ref: "L19", depth: 2, description: "Install ceiling speakers", part_number: "", qty: 1, unit_price: 190.2, total: 190.2 },
  { ref: "L20", depth: 1, description: "CABLING-INSTALL", part_number: "", qty: 1, unit_price: 0, total: 237.75, is_rollup: true },
  { ref: "L21", depth: 2, description: "Run HDMI AOC per metre", part_number: "", qty: 20, unit_price: 9.51, total: 190.2 },
  { ref: "L22", depth: 2, description: "Terminate data outlets", part_number: "", qty: 1, unit_price: 47.55, total: 47.55 },
  { ref: "L23", depth: 1, description: "ENGINEER", part_number: "", qty: 1, unit_price: 552, total: 552, is_rollup: true },
  { ref: "L24", depth: 1, description: "COMMISSION", part_number: "", qty: 1, unit_price: 103.5, total: 103.5, is_rollup: true },
  { ref: "L25", depth: 1, description: "PROGRAM", part_number: "", qty: 1, unit_price: 1152, total: 1152, is_rollup: true },
  { ref: "L26", depth: 1, description: "PROJECT-MANAGE", part_number: "", qty: 1, unit_price: 624, total: 624, is_rollup: true },
]);

/** Same rows with the nesting information removed (what a flat table gives us). */
export const videoExpandedFlat: ExtractedLineItem[] = videoExpandedWithDepth.map((r) => ({ ...r, depth: 0 }));

/** Expected parent of each ref in the expanded section. */
export const EXPECTED_PARENTS: Record<string, string | null> = {
  L1: null, L2: null, L3: null, L4: null, L5: null, L6: "L5", L7: "L5", L8: "L5", L9: "L5", L10: null, L11: null, L12: null,
  L13: "L12", L14: "L13", L15: "L13", L16: "L12", L17: "L16", L18: "L16", L19: "L16", L20: "L12", L21: "L20", L22: "L20",
  L23: "L12", L24: "L12", L25: "L12", L26: "L12",
};

/** The PDF (non-expanded) version: only the four roll-ups. */
export const videoCollapsed: ExtractedLineItem[] = rows("S1", [
  { ref: "L1", description: "Epson EB-PU1007W 7,000lm laser projector", part_number: "EB-PU1007W", qty: 1, unit_price: 8390, total: 8390 },
  { ref: "L2", description: "Existing motorised screen (retained)", part_number: "OFE", qty: 1, unit_price: 0, total: 0 },
  { ref: "L3", description: "Existing amplifier (retained)", part_number: "OFE", qty: 1, unit_price: 0, total: 0 },
  { ref: "L4", description: "Projector ceiling pole and bracket", part_number: "CUSTOM", qty: 1, unit_price: 1240, total: 1240 },
  { ref: "L5", description: "Cabling", part_number: "CABLING", qty: 1, unit_price: 816.7, total: 816.7, is_rollup: true },
  { ref: "L6", description: "Hardware & Consumables", part_number: "CONS", qty: 1, unit_price: 220, total: 220, is_rollup: true },
  { ref: "L7", description: "Freight & Logistics", part_number: "FREIGHT", qty: 1, unit_price: 110, total: 110, is_rollup: true },
  { ref: "L8", description: "Services", part_number: "SERVICES", qty: 1, unit_price: 3056.79, total: 3056.79, is_rollup: true },
]);

/** A bundle listed once and then broken into its parts (AirServer pattern). */
export const bundleRows: ExtractedLineItem[] = rows("S2", [
  { ref: "B1", description: "AirServer Connect 2 bundle", part_number: "ASC2-BUNDLE", qty: 1, unit_price: 1450, total: 1450 },
  { ref: "B2", description: "AirServer Connect 2 unit", part_number: "ASC2", qty: 1, unit_price: 1350, total: 1350 },
  { ref: "B3", description: "AirServer power pack", part_number: "ASC2-PSU", qty: 1, unit_price: 100, total: 100 },
  { ref: "B4", description: "Cabling", part_number: "CABLING", qty: 1, unit_price: 200, total: 200, is_rollup: true },
  { ref: "B5", description: "Hardware & Consumables", part_number: "CONS", qty: 1, unit_price: 110, total: 110, is_rollup: true },
  { ref: "B6", description: "Freight & Logistics", part_number: "FREIGHT", qty: 1, unit_price: 110, total: 110, is_rollup: true },
  { ref: "B7", description: "Services", part_number: "SERVICES", qty: 1, unit_price: 500, total: 500, is_rollup: true },
]);
export const BUNDLE_TOTAL = 1450 + 200 + 110 + 110 + 500; // 2370

export function jobWith(lines: ExtractedLineItem[], sectionTotal: number = VIDEO_TOTAL): ExtractedJob {
  return {
    header: {
      job_number: "6570",
      title: "Eastwood Heights PS – Hall Upgrade",
      client_org: "NSW Department of Education",
      contact_name: "",
      site_suburb: "Eastwood Heights",
      issued_on: "2026-09-21",
      structure: "sections",
      is_expanded_export: true,
    },
    summary: {
      sections: [{ name: "Video", total: sectionTotal }],
      subtotal_ex_gst: sectionTotal,
      gst: Math.round(sectionTotal * 10) / 100,
      total_inc_gst: Math.round(sectionTotal * 110) / 100,
    },
    sections: [{ ref: "S1", name: "Video", kind: "system", total: sectionTotal }],
    line_items: lines,
    optional_items: [],
    scope_paragraphs: ["Replace the projector."],
    assumptions: ["Access after hours."],
    exclusions: ["Electrical works."],
    params: [
      { key: "room_type", value: "hall" },
      { key: "install_type", value: "upgrade" },
      { key: "staged", value: "false" },
      { key: "projectors_new", value: "1" },
      { key: "projector_lumens", value: "7000" },
      { key: "screens_retained", value: "1" },
      { key: "rack", value: "reuse" },
      { key: "ewp_required", value: "yes" },
      { key: "decomm_item_count", value: "2" },
      { key: "audio_zones", value: "hall, COLA" },
    ],
  };
}

export const RATE_CARD = [
  { code: "INSTALL", rate: 95.1, unit: "hour" },
  { code: "CABLING-INSTALL", rate: 95.1, unit: "hour" },
  { code: "DE-COMM", rate: null, unit: "item" },
  { code: "ENGINEER", rate: 138, unit: "hour" },
  { code: "COMMISSION", rate: 138, unit: "hour" },
  { code: "PROGRAM", rate: 144, unit: "hour" },
  { code: "PROJECT-MANAGE", rate: 156, unit: "hour" },
  { code: "ACCESS", rate: null, unit: "item" },
];
