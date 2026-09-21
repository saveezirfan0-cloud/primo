import { z } from "zod";
import type { Spec } from "@/lib/schemas/spec";
import type { PartRecord } from "@/lib/knowledge/types";
import { structured } from "./llm";
import type { PartChoice } from "./build";

const Choices = z.object({
  choices: z.array(z.object({ component_ref: z.string(), part_number: z.string().describe("A part_number from the candidate list, or '' if none is suitable"), reason: z.string() })),
});

const SYSTEM = `You match components of an AV specification to parts from Primo Group Services' price book. Pick the candidate that best fits each NEW component (same category and function; match lumens, channel counts, sizes where stated). Prefer parts used in the most recent jobs. If no candidate is a sensible fit, return '' for that component. Never invent part numbers.`;

/** Ask Claude to choose among candidate parts for the new components. Code does the pricing. */
export async function choosePartsForComponents(spec: Spec, parts: PartRecord[]): Promise<PartChoice[]> {
  const comps = spec.components.filter((c) => c.status === "new");
  if (comps.length === 0 || parts.length === 0) return [];
  const cats = new Set(comps.map((c) => c.category));
  const candidates = parts.filter((p) => cats.has(p.category) || p.category === "other");
  if (candidates.length === 0) return [];
  const user = `Components:
${comps.map((c) => `- ${c.ref} [${c.category}] ${c.description} x${c.qty}${c.part_hint ? ` (hint: ${c.part_hint})` : ""}${c.notes ? ` — ${c.notes}` : ""}`).join("\n")}

Candidate parts (part_number | category | latest price | used in jobs | description):
${candidates.map((p) => `- ${p.part_number} | ${p.category} | $${p.last_price} | ${p.jobs.join(",")} | ${p.description.slice(0, 110)}`).join("\n")}

Return one choice per component.`;
  const out = await structured(Choices, SYSTEM, user, 4000);
  const valid = new Set(candidates.map((p) => p.part_number));
  return out.choices.filter((c) => c.part_number === "" || valid.has(c.part_number)).map((c) => ({ component_ref: c.component_ref, part_number: c.part_number }));
}
