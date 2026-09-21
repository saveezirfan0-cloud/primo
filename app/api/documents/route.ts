import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { detectKind } from "@/lib/ingest/prepare";
import { uploadDocument } from "@/lib/ingest/storage";
import { ingestBuffer, loadRateCard } from "@/lib/ingest/pipeline";

export const runtime = "nodejs";
export const maxDuration = 300;

/** POST multipart/form-data { file } -> uploads, extracts, validates, returns { id }. */
export async function POST(request: Request) {
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "No file uploaded." }, { status: 400 });

  const kind = detectKind(file.name, file.type);
  if (!kind) return NextResponse.json({ error: "Only .pdf and .docx files are supported." }, { status: 400 });

  const buffer = Buffer.from(await file.arrayBuffer());
  const db = supabaseAdmin();

  let storagePath: string;
  try {
    storagePath = await uploadDocument(buffer, file.name, file.type || (kind === "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.wordprocessingml.document"));
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Upload failed." }, { status: 500 });
  }

  const { data: doc, error: insErr } = await db
    .from("documents")
    .insert({ kind, storage_path: storagePath, file_name: file.name, status: "uploaded" })
    .select("id")
    .single();
  if (insErr || !doc) return NextResponse.json({ error: insErr?.message ?? "Could not create document row." }, { status: 500 });

  try {
    const rateCard = await loadRateCard();
    const out = await ingestBuffer(buffer, kind, rateCard);
    const { error: updErr } = await db
      .from("documents")
      .update({
        extraction: { raw: out.raw, processed: out.processed, meta: out.meta },
        validation: out.processed.validation,
        status: "extracted",
      })
      .eq("id", doc.id);
    if (updErr) throw new Error(updErr.message);
    return NextResponse.json({ id: doc.id, ok: out.processed.validation.ok });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Extraction failed.";
    await db.from("documents").update({ status: "failed", validation: { ok: false, messages: [message] } }).eq("id", doc.id);
    return NextResponse.json({ id: doc.id, error: message }, { status: 500 });
  }
}
