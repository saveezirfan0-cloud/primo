import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { ExtractedJob } from "@/lib/schemas/extraction";
import type { PreparedDocument } from "./prepare";

/** Model for extraction; CLAUDE.md specifies claude-sonnet-5. Override with EXTRACTION_MODEL. */
export const EXTRACTION_MODEL = process.env.EXTRACTION_MODEL ?? "claude-sonnet-5";

const SYSTEM_PROMPT = `You extract structured data from AV integration proposals produced by Primo Group Services (AroFlo template).

Document order: Cover, letter, Scope of Works, Handover, Summary Pricing (section totals, subtotal, GST, total), Optional Items ("+$"), Detailed Bill of Materials, Notes & Assumptions, Exclusions, then "Acceptance & Payment" and Terms & Conditions.

Rules:
- Ignore everything from "Acceptance & Payment" onward. Never output bank details, phone numbers, email addresses or postal addresses. Client contact is name only.
- Copy every number exactly as printed. Do not compute, correct, or reconcile totals; code checks the arithmetic afterwards. A blank money cell is 0; a blank text cell is "".
- The Bill of Materials is grouped by section (systems like "Hall Upgrade - Video" / Audio / Control, stages like Stage 1, or a single section). Output one section per BOM group in order and one line item per BOM row in document order, including OFE (owner-furnished/existing, $0) and CUSTOM rows. Include the section's own summary row if it appears as a table row (same name as the section, qty 1) at depth 0.
- Every section normally ends with four roll-up rows: CABLING, CONS (Hardware & Consumables), FREIGHT, SERVICES. Give them grp accordingly and is_rollup=true.
- Nesting: expanded exports indent nested rows. In text input each indent level is shown by a leading "›" character per level in the Item cell (e.g. "›› Panasonic projector" is depth 2). In PDFs the Item text is visually indented. Report the indent level as depth and strip the markers from description. Typical structure: section row (0) -> Equipment / Cabling / Hardware & Consumables / Freight & Logistics / Services (1) -> items or activity rows such as DE-COMM, INSTALL, CABLING-INSTALL, RACK-BUILD, ENGINEER, DOCUMENT, COMMISSION, PROGRAM, TRAIN, O&M, PROJECT-MANAGE, RUBBISH, EWASTE, PARKING, TRAVEL+ACCOMM, ACCESS, WORKSHOP (2) -> per-item rows (3) -> sub-parts (4). Bundles and cable assemblies also nest their parts one level deeper. Rows nested under an activity row are grp SERVICES; rows nested under Cabling are grp CABLING.
- If nesting is not visible, use depth 0 for every row. Never invent rows.
- Scope paragraphs, assumptions and exclusions are verbatim.
- params describe the job for similarity matching: count new vs retained (OFE) items, mics, inputs, whether an EWP/scissor lift is required, whether pricing is staged, etc. Only include keys the document supports.`;

function userContent(doc: PreparedDocument): Anthropic.ContentBlockParam[] {
  const instruction: Anthropic.TextBlockParam = {
    type: "text",
    text: "Extract this proposal into the required structure. Refs: use S1, S2... for sections and L1, L2... for line items in document order.",
  };
  if (doc.kind === "pdf") {
    return [
      { type: "document", source: { type: "base64", media_type: "application/pdf", data: doc.base64 }, title: "Proposal PDF" },
      instruction,
    ];
  }
  return [
    { type: "document", source: { type: "text", media_type: "text/plain", data: doc.text }, title: "Proposal (text export from Word; table rows as 'Item | Part | Quantity | Price Each | Price Total'; truncated before Acceptance & Payment)" },
    instruction,
  ];
}

export type ExtractionResult = {
  extracted: ExtractedJob;
  usage: { input_tokens: number; output_tokens: number };
  model: string;
};

export async function extractProposal(doc: PreparedDocument): Promise<ExtractionResult> {
  const client = new Anthropic({ timeout: 10 * 60 * 1000 });
  const stream = client.messages.stream({
    model: EXTRACTION_MODEL,
    max_tokens: 64000,
    system: SYSTEM_PROMPT,
    thinking: { type: "adaptive" },
    output_config: { effort: "high", format: zodOutputFormat(ExtractedJob) },
    messages: [{ role: "user", content: userContent(doc) }],
  });
  const message = await stream.finalMessage();

  if (message.stop_reason === "refusal") throw new Error("The model declined to process this document.");
  if (message.stop_reason === "max_tokens") throw new Error("Extraction output was cut off (max_tokens). The document may be too long.");

  const text = message.content.find((b): b is Anthropic.TextBlock => b.type === "text")?.text ?? "";
  const parsed = ExtractedJob.safeParse(JSON.parse(text));
  if (!parsed.success) throw new Error(`Extraction did not match the schema: ${parsed.error.issues.slice(0, 3).map((i) => i.message).join("; ")}`);

  return {
    extracted: parsed.data,
    usage: { input_tokens: message.usage.input_tokens, output_tokens: message.usage.output_tokens },
    model: message.model,
  };
}
