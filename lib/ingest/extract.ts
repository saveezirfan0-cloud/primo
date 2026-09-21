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
- Copy every number exactly as printed. Do not compute, correct, or reconcile totals; code checks the arithmetic afterwards. Use null for blank cells.
- The Bill of Materials is grouped by section (systems like Video / Audio / Control, stages like Stage 1, or a single section). Output one section per BOM group in order and one line item per BOM row in document order, including OFE (owner-furnished/existing, $0) and CUSTOM rows.
- Every section normally ends with four roll-up rows: CABLING, CONS (Hardware & Consumables), FREIGHT, SERVICES. Mark them grp accordingly and is_rollup=true.
- Expanded exports break roll-ups into indented child rows (e.g. SERVICES -> INSTALL -> one row per installed item; CABLING -> cable assemblies, per-metre cable, connectors, Contingency). When the document shows that nesting, set parent_ref to the enclosing roll-up/activity row's ref. Activity rows (DE-COMM, INSTALL, CABLING-INSTALL, RACK-BUILD, ENGINEER, DOCUMENT, COMMISSION, PROGRAM, TRAIN, O&M, PROJECT-MANAGE, RUBBISH, EWASTE, PARKING, TRAVEL+ACCOMM, ACCESS, WORKSHOP) are is_rollup=true with grp SERVICES. If a bundle is listed once and then again broken into its parts, keep both rows and make the parts children of the bundle row.
- If nesting is not visible, leave parent_ref null. Never invent rows.
- Scope paragraphs, assumptions and exclusions are verbatim.
- params describe the job for similarity matching: count new vs retained (OFE) items, mics, inputs, whether an EWP/scissor lift is required, whether pricing is staged, etc. Use null when the document does not say.`;

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
    { type: "document", source: { type: "text", media_type: "text/plain", data: doc.html }, title: "Proposal (HTML export from Word, truncated before Acceptance & Payment)" },
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
