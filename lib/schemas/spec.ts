import { z } from "zod";
import { CATEGORY_RULES } from "@/lib/knowledge/categories";
import { PARAM_KEYS, paramsFromList, type ExtractedParams } from "./extraction";

export const COMPONENT_CATEGORIES = [...new Set(CATEGORY_RULES.map((r) => r.category)), "other"] as const;

/**
 * Component spec produced from a brief. Nullable-free (structured output limit).
 * The LLM decides WHAT is in the job; code decides HOW MUCH it costs.
 */
export const SpecComponent = z.object({
  ref: z.string().describe("C1, C2, ..."),
  section_ref: z.string().describe("ref of the section this component belongs to"),
  category: z.enum(COMPONENT_CATEGORIES as unknown as [string, ...string[]]),
  description: z.string().describe("Plain description in Primo's vocabulary, e.g. '6,500 lm laser projector'"),
  qty: z.number().describe("Quantity; 1 if not stated"),
  status: z.enum(["new", "retained", "remove"]).describe("new = supply and install; retained = existing equipment kept (OFE); remove = decommission only"),
  part_hint: z.string().describe("A specific part number from the reference jobs if the brief clearly implies it, else ''"),
  notes: z.string().describe("Anything the estimator should know, e.g. 'on a new ceiling pole', else ''"),
});
export type SpecComponent = z.infer<typeof SpecComponent>;

export const Spec = z.object({
  title: z.string().describe("Project title in Primo's format, e.g. 'Mount Pritchard East PS - Hall Upgrade'"),
  room_type: z.enum(["hall", "auditorium", "classroom", "library", "gym", "other"]),
  install_type: z.enum(["upgrade", "new"]),
  sections: z
    .array(z.object({ ref: z.string(), name: z.string(), kind: z.enum(["system", "stage", "single"]) }))
    .describe("Pricing sections. Use Primo's names, e.g. 'Hall Upgrade - Video' / '- Audio' / '- Control'. One section named after the project when the brief does not ask for a split."),
  components: z.array(SpecComponent),
  params: z
    .array(z.object({ key: z.enum(PARAM_KEYS), value: z.string() }))
    .describe("Cost drivers implied by the brief (numbers/booleans as strings). Include ewp_required, staged, counts of new vs retained items."),
  ewp_required: z.boolean(),
  summary: z.string().describe("One or two sentences summarising the job for the estimator"),
});
export type Spec = z.infer<typeof Spec>;

export function specParams(spec: Spec): ExtractedParams {
  const p = paramsFromList(spec.params);
  p.room_type = spec.room_type;
  p.install_type = spec.install_type;
  p.ewp_required = spec.ewp_required;
  if (p.staged === null) p.staged = spec.sections.some((s) => s.kind === "stage");
  return p;
}
