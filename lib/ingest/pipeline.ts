import type { RateCardEntry, ProcessedJob } from "./types";
import { prepareDocument } from "./prepare";
import { extractProposal } from "./extract";
import { processExtraction } from "./process";
import type { ExtractedJob } from "@/lib/schemas/extraction";

export type IngestOutput = {
  raw: ExtractedJob;
  processed: ProcessedJob;
  meta: { model: string; input_tokens: number; output_tokens: number; truncated: boolean; ms: number };
};

/** Prepare -> extract -> post-process -> validate. Nothing is written to the DB here. */
export async function ingestBuffer(buffer: Buffer, kind: "pdf" | "docx", rateCard: RateCardEntry[]): Promise<IngestOutput> {
  const started = Date.now();
  const prepared = await prepareDocument(buffer, kind);
  const { extracted, usage, model } = await extractProposal(prepared);
  const processed = processExtraction(extracted, rateCard);
  return {
    raw: extracted,
    processed,
    meta: {
      model,
      input_tokens: usage.input_tokens,
      output_tokens: usage.output_tokens,
      truncated: prepared.kind === "docx" ? prepared.truncated : false,
      ms: Date.now() - started,
    },
  };
}
