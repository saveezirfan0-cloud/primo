import { z } from "zod";

/**
 * Structured-output schema for proposal extraction.
 *
 * Design notes:
 * - Every line item has a `ref` (unique within the document) and an optional
 *   `parent_ref` so expanded exports can be represented as a tree. Code later
 *   re-checks the tree by arithmetic and infers missing links from sums.
 * - The model reports numbers exactly as printed; code does all arithmetic.
 * - Nothing from "Acceptance & Payment" onward is extracted.
 */

export const LINE_GROUPS = ["EQUIPMENT", "CABLING", "CONS", "FREIGHT", "SERVICES"] as const;
export type LineGroup = (typeof LINE_GROUPS)[number];

export const ACTIVITY_CODES = [
  "DE-COMM",
  "INSTALL",
  "CABLING-INSTALL",
  "RACK-BUILD",
  "ENGINEER",
  "DOCUMENT",
  "COMMISSION",
  "PROGRAM",
  "TRAIN",
  "O&M",
  "PROJECT-MANAGE",
  "RUBBISH",
  "EWASTE",
  "PARKING",
  "TRAVEL+ACCOMM",
  "ACCESS",
  "WORKSHOP",
] as const;
export type ActivityCode = (typeof ACTIVITY_CODES)[number];

const money = z.number().nullable().describe("AUD ex GST exactly as printed; null if the cell is blank");

export const ExtractedLineItem = z.object({
  ref: z.string().describe("Unique id within this document, e.g. 'L12'"),
  parent_ref: z
    .string()
    .nullable()
    .describe("ref of the roll-up row this line is a child of (expanded exports only), else null"),
  section_ref: z.string().describe("ref of the section this line belongs to"),
  grp: z
    .enum(LINE_GROUPS)
    .describe(
      "EQUIPMENT for equipment/OFE/CUSTOM lines; CABLING, CONS (Hardware & Consumables), FREIGHT, SERVICES for the roll-ups and everything under them",
    ),
  description: z.string(),
  part_number: z.string().nullable().describe("Part column as printed, e.g. 'OFE', 'CUSTOM', 'CABLING', 'MTX3'; null if blank"),
  qty: z.number().describe("Quantity as printed; 1 if blank"),
  unit_price: money,
  total: money,
  is_rollup: z
    .boolean()
    .describe("true if this row is a roll-up/subtotal row (CABLING, CONS, FREIGHT, SERVICES, an activity code like INSTALL, or a bundle whose parts are listed under it)"),
});
export type ExtractedLineItem = z.infer<typeof ExtractedLineItem>;

export const ExtractedSection = z.object({
  ref: z.string(),
  name: z.string().describe("Section heading as printed, e.g. 'Video', 'Stage 1', or the job title for a single-section quote"),
  kind: z.enum(["system", "stage", "single"]),
  total: money.describe("Section total from the Bill of Materials / Summary Pricing"),
});
export type ExtractedSection = z.infer<typeof ExtractedSection>;

export const ExtractedOptionalItem = z.object({
  description: z.string(),
  part_number: z.string().nullable(),
  qty: z.number(),
  unit_price: money,
  total: money.describe("The '+$' price"),
});

export const ExtractedParams = z.object({
  room_type: z.enum(["hall", "auditorium", "classroom", "library", "gym", "other"]).nullable(),
  install_type: z.enum(["upgrade", "new"]).nullable(),
  staged: z.boolean().nullable(),
  projectors_new: z.number().nullable(),
  projector_lumens: z.number().nullable(),
  screens_new: z.number().nullable(),
  screens_retained: z.number().nullable(),
  speakers_new: z.number().nullable(),
  speakers_retained: z.number().nullable(),
  audio_zones: z.array(z.string()).nullable().describe("e.g. ['hall', 'COLA']"),
  amp_channels_new: z.number().nullable(),
  wireless_mic_channels: z.number().nullable(),
  wired_mics: z.number().nullable(),
  dsp_new: z.boolean().nullable(),
  dante: z.boolean().nullable(),
  stage_io: z.boolean().nullable(),
  touch_panels: z.number().nullable(),
  control_processor: z.boolean().nullable(),
  video_inputs: z.number().nullable(),
  video_input_locations: z.array(z.string()).nullable(),
  wireless_presentation: z.boolean().nullable(),
  rack: z.enum(["new", "reuse", "none"]).nullable(),
  rack_ru: z.number().nullable(),
  hearing_augmentation: z.enum(["none", "retain_integrate", "new"]).nullable(),
  lighting_integration: z.boolean().nullable(),
  recording_streaming: z.boolean().nullable(),
  ewp_required: z.boolean().nullable(),
  decomm_item_count: z.number().nullable(),
  optional_items_count: z.number().nullable(),
});
export type ExtractedParams = z.infer<typeof ExtractedParams>;

export const ExtractedJob = z.object({
  header: z.object({
    job_number: z.string().describe("Digits only, e.g. '6570'"),
    title: z.string().describe("Project title, e.g. 'Eastwood Heights PS – Hall Upgrade'"),
    client_org: z.string().nullable().describe("Client organisation name only"),
    contact_name: z.string().nullable().describe("Client contact's name only; never phone/email"),
    site_suburb: z.string().nullable(),
    issued_on: z.string().nullable().describe("ISO date YYYY-MM-DD"),
    structure: z.enum(["sections", "stages", "single"]),
    is_expanded_export: z
      .boolean()
      .describe("true if roll-ups (CABLING/CONS/FREIGHT/SERVICES) are broken out into child rows"),
  }),
  summary: z.object({
    sections: z.array(z.object({ name: z.string(), total: money })).describe("Rows from Summary Pricing"),
    subtotal_ex_gst: money,
    gst: money,
    total_inc_gst: money,
  }),
  sections: z.array(ExtractedSection),
  line_items: z.array(ExtractedLineItem).describe("Every row of the Detailed Bill of Materials, in document order"),
  optional_items: z.array(ExtractedOptionalItem),
  scope_paragraphs: z.array(z.string()).describe("Scope of Works paragraphs verbatim, in order"),
  assumptions: z.array(z.string()).describe("Notes & Assumptions bullets verbatim"),
  exclusions: z.array(z.string()).describe("Exclusions bullets verbatim"),
  params: ExtractedParams,
});
export type ExtractedJob = z.infer<typeof ExtractedJob>;
