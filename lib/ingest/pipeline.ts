import "server-only";
import { supabaseAdmin } from "@/lib/supabase/server";
import type { RateCardEntry } from "./types";
import { prepareDocument } from "./prepare";
import { extractProposal } from "./extract";
import { processExtraction } from "./process";
import type { ProcessedJob } from "./types";
import type { ExtractedJob } from "@/lib/schemas/extraction";

export async function loadRateCard(): Promise<RateCardEntry[]> {
  const { data, error } = await supabaseAdmin().from("rate_card").select("code, rate, unit");
  if (error) throw new Error(`rate_card: ${error.message}`);
  return (data ?? []).map((r) => ({ code: r.code, rate: r.rate === null ? null : Number(r.rate), unit: r.unit }));
}

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
