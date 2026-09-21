import "server-only";
import { supabaseAdmin } from "@/lib/supabase/server";

/** Bucket name; configurable so the demo can share a Supabase project. */
export const DOCUMENTS_BUCKET = process.env.SUPABASE_DOCUMENTS_BUCKET ?? "documents";

export async function uploadDocument(buffer: Buffer, fileName: string, mime: string): Promise<string> {
  const safe = fileName.replace(/[^A-Za-z0-9._-]+/g, "_");
  const path = `${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}-${safe}`;
  const { error } = await supabaseAdmin().storage.from(DOCUMENTS_BUCKET).upload(path, buffer, { contentType: mime, upsert: false });
  if (error) throw new Error(`Storage upload failed: ${error.message}`);
  return path;
}
