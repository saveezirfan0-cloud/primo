import { z } from "zod";
import type { Spec } from "@/lib/schemas/spec";
import type { KJob } from "@/lib/knowledge/types";
import type { Draft, DraftText } from "./types";
import { structured } from "./llm";

const TextOut = z.object({
  scope_paragraphs: z.array(z.string()).describe("Scope of Works paragraphs in Primo's style, one per system/topic"),
  assumptions: z.array(z.string()).describe("Notes & Assumptions bullets, each starting 'We have assumed' or 'We have allowed'"),
  exclusions: z.array(z.string()).describe("Exclusions bullets"),
  equipment_mentioned: z.array(z.string()).describe("Every product or equipment item named in the scope text, one short phrase each"),
});

const SYSTEM = `You write the Scope of Works, Notes & Assumptions and Exclusions for a Primo Group Services AV proposal, in the same register as the reference proposals: third person, plain, precise, no marketing language.

Hard rules:
- Only describe equipment that appears in the draft line items provided. Do not add products, features or quantities that are not in the lines.
- Retained (OFE) items are described as retained/reused and integrated.
- Reuse the reference assumptions and exclusions that apply to this job (e.g. parking, access, EWP floor protection, network by client, electrical excluded, make good excluded) and drop those that do not.
- Keep it to what an estimator would send: 6-14 scope paragraphs, 10-25 assumptions, 15-40 exclusions.`;

/** Draft text from the spec, the priced lines and the matched jobs' text. Validates mentions against the lines. */
export async function draftText(spec: Spec, draft: Draft, referenceJobs: KJob[]): Promise<{ text: DraftText; warnings: string[] }> {
  const lines = draft.sections.flatMap((s) => s.lines.filter((l) => l.grp === "EQUIPMENT").map((l) => `- [${s.name}] ${l.description} x${l.qty}${l.is_existing ? " (retained, OFE)" : ""}`));
  const labour = draft.sections.flatMap((s) => s.lines.filter((l) => l.grp === "SERVICES" && l.activity && !["INSTALL", "DE-COMM"].includes(l.activity)).map((l) => `- [${s.name}] ${l.description}`));
  const decomm = draft.sections.flatMap((s) => s.lines.filter((l) => l.activity === "DE-COMM").map((l) => `- ${l.description}`));
  const refs = referenceJobs
    .slice(0, 2)
    .map((j) => `Job ${j.job_number} "${j.title}"\nScope:\n${(j.scope_text ?? "").slice(0, 6000)}\nAssumptions:\n${j.assumptions.map((a) => `- ${a}`).join("\n")}\nExclusions:\n${j.exclusions.map((e) => `- ${e}`).join("\n")}`)
    .join("\n\n----\n\n");

  const user = `Project: ${spec.title} (${spec.room_type}, ${spec.install_type})
Summary: ${spec.summary}
EWP required: ${spec.ewp_required}

Draft equipment lines (the ONLY equipment you may mention):
${lines.join("\n")}

Services included:
${labour.join("\n") || "- (none itemised)"}

De-commissioning:
${decomm.join("\n") || "- (none)"}

Reference proposals for style and standard clauses:
${refs}

Write the scope, assumptions and exclusions.`;

  const out = await structured(TextOut, SYSTEM, user, 12000);
  const warnings: string[] = [];
  const hay = draft.sections.flatMap((s) => s.lines.map((l) => l.description.toLowerCase())).join(" \n ");
  for (const m of out.equipment_mentioned) {
    const tokens = m.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length > 3);
    if (tokens.length === 0) continue;
    const hit = tokens.filter((t) => hay.includes(t)).length / tokens.length;
    if (hit < 0.5) warnings.push(`Scope text mentions "${m}" which is not in the draft lines.`);
  }
  return { text: { scope_paragraphs: out.scope_paragraphs, assumptions: out.assumptions, exclusions: out.exclusions }, warnings };
}
