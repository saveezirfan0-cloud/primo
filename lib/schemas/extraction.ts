import { z } from "zod";

/**
 * Structured-output schema for proposal extraction.
 *
 * Constraints: the Claude structured-output compiler allows at most 16
 * nullable/union fields per schema, so this schema uses sentinels instead of
 * null: "" for an absent string, 0 for a blank money cell. Nesting is carried
 * as `depth` (indent level) rather than parent links; code rebuilds the tree.
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

export const PARAM_KEYS = [
  "room_type",
  "install_type",
  "staged",
  "projectors_new",
  "projector_lumens",
  "screens_new",
  "screens_retained",
  "speakers_new",
  "speakers_retained",
  "audio_zones",
  "amp_channels_new",
  "wireless_mic_channels",
  "wired_mics",
  "dsp_new",
  "dante",
  "stage_io",
  "touch_panels",
  "control_processor",
  "video_inputs",
  "video_input_locations",
  "wireless_presentation",
  "rack",
  "rack_ru",
  "hearing_augmentation",
  "lighting_integration",
  "recording_streaming",
  "ewp_required",
  "decomm_item_count",
  "optional_items_count",
] as const;
export type ParamKey = (typeof PARAM_KEYS)[number];

const money = z.number().describe("AUD ex GST exactly as printed; 0 if the cell is blank");

export const ExtractedLineItem = z.object({
  ref: z.string().describe("Unique id within this document, e.g. 'L12'"),
  section_ref: z.string().describe("ref of the section this row belongs to"),
  depth: z
    .number()
    .int()
    .describe("Indent level of the Item cell: 0 for a top-level row, 1 for a row nested under the previous less-indented row, and so on"),
  grp: z
    .enum(LINE_GROUPS)
    .describe("EQUIPMENT for equipment/OFE/CUSTOM rows; CABLING, CONS (Hardware & Consumables), FREIGHT, SERVICES for those roll-ups and every row nested under them"),
  description: z.string().describe("Item text without the indent markers"),
  part_number: z.string().describe("Part column as printed ('OFE', 'CUSTOM', 'CABLING', 'PT-VMZ82', '-'); '' if blank"),
  qty: z.number().describe("Quantity as printed; 1 if blank"),
  unit_price: money,
  total: money,
  is_rollup: z.boolean().describe("true if rows are nested under this row, or it is one of the four roll-ups or a labour activity row"),
});
export type ExtractedLineItem = z.infer<typeof ExtractedLineItem>;

export const ExtractedSection = z.object({
  ref: z.string(),
  name: z.string().describe("Section heading as printed, e.g. 'Hall Upgrade - Video', 'Stage 1'"),
  kind: z.enum(["system", "stage", "single"]),
  total: money.describe("Section total shown in the Bill of Materials heading or Summary Pricing"),
});
export type ExtractedSection = z.infer<typeof ExtractedSection>;

export const ExtractedOptionalItem = z.object({
  description: z.string(),
  part_number: z.string().describe("'' if blank"),
  qty: z.number(),
  unit_price: money,
  total: money.describe("The '+$' price"),
});

export const ExtractedJob = z.object({
  header: z.object({
    job_number: z.string().describe("Digits only, e.g. '6570'"),
    title: z.string().describe("Project title, e.g. 'Eastwood Heights PS - Hall Upgrade'"),
    client_org: z.string().describe("Client organisation name only; '' if not stated"),
    contact_name: z.string().describe("Client contact's name only, never phone/email; '' if not stated"),
    site_suburb: z.string().describe("'' if not stated"),
    issued_on: z.string().describe("ISO date YYYY-MM-DD; '' if not stated"),
    structure: z.enum(["sections", "stages", "single"]),
    is_expanded_export: z.boolean().describe("true if the roll-ups (CABLING/CONS/FREIGHT/SERVICES) have rows nested under them"),
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
  params: z
    .array(z.object({ key: z.enum(PARAM_KEYS), value: z.string() }))
    .describe(
      "Cost drivers the document supports; omit unknown ones. Values as strings: numbers ('3'), booleans ('true'/'false'), lists comma-separated ('hall, COLA'). room_type: hall|auditorium|classroom|library|gym|other. install_type: upgrade|new. rack: new|reuse|none. hearing_augmentation: none|retain_integrate|new.",
    ),
});
export type ExtractedJob = z.infer<typeof ExtractedJob>;

/** Typed params used internally and stored in jobs.params (nullable is fine here: never sent to the API). */
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
  audio_zones: z.array(z.string()).nullable(),
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

const EMPTY_PARAMS: ExtractedParams = Object.fromEntries(PARAM_KEYS.map((k) => [k, null])) as ExtractedParams;

/** Convert the key/value list from the model into the typed params object. Unparseable values become null. */
export function paramsFromList(list: Array<{ key: string; value: string }>): ExtractedParams {
  const shape = ExtractedParams.shape;
  const out: Record<string, unknown> = { ...EMPTY_PARAMS };
  for (const { key, value } of list) {
    if (!(key in shape)) continue;
    const raw = value.trim();
    if (raw === "" || /^(null|unknown|n\/a|none stated)$/i.test(raw)) continue;
    const field = shape[key as ParamKey].unwrap();
    let candidate: unknown = raw;
    if (field instanceof z.ZodBoolean) candidate = /^(true|yes|y|1)$/i.test(raw) ? true : /^(false|no|n|0)$/i.test(raw) ? false : raw;
    else if (field instanceof z.ZodNumber) candidate = Number(raw.replace(/[^0-9.-]/g, ""));
    else if (field instanceof z.ZodArray) candidate = raw.split(/\s*[,;]\s*/).filter(Boolean);
    else if (field instanceof z.ZodEnum) candidate = raw.toLowerCase().replace(/[\s-]+/g, "_");
    const parsed = field.safeParse(candidate);
    if (parsed.success) out[key] = parsed.data;
  }
  return out as ExtractedParams;
}
