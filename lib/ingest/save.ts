import "server-only";
import { supabaseAdmin } from "@/lib/supabase/server";
import type { ProcessedJob } from "./types";
import { buildSavePayload } from "./payload";

/** Save a processed job in one transaction via the save_job RPC. Returns the job id. */
export async function saveProcessedJob(job: ProcessedJob, opts: { documentId?: string | null; isHoldout?: boolean } = {}): Promise<string> {
  const { data, error } = await supabaseAdmin().rpc("save_job", { p: buildSavePayload(job, opts) });
  if (error) throw new Error(`save_job failed: ${error.message}`);
  return data as unknown as string;
}
