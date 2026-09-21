/**
 * Ingest the library documents from seed/docs without the UI review step.
 *
 *   npm run seed            # 6570 pdf, 6570 docx (expanded, becomes latest revision), 6401, 6521
 *   npm run seed -- --force # save even when the arithmetic check fails
 *   npm run seed -- --dry   # extract + validate only, no writes
 *   npm run seed -- --offline # no DB access: use the default rate card and write
 *                             # save_job payloads to seed/out/*.json for manual loading
 *
 * 6427 (the holdout) is never seeded here. Nothing is marked as holdout.
 */
import "dotenv/config";
import { config } from "dotenv";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

config({ path: ".env.local", override: false });

const args = new Set(process.argv.slice(2));
const FORCE = args.has("--force");
const DRY = args.has("--dry");
const OFFLINE = args.has("--offline");
const OUT_DIR = path.join(process.cwd(), "seed", "out");

const DOCS_DIR = path.join(process.cwd(), "seed", "docs");
const HOLDOUT = "6427";

// Order matters for revisions: the PDF first so the expanded .docx becomes the active revision.
const ORDER = ["6570_2026", "6570__1_", "6401", "6521"];

async function main() {
  const { ingestBuffer } = await import("../lib/ingest/pipeline");
  const { detectKind } = await import("../lib/ingest/prepare");
  const { buildSavePayload } = await import("../lib/ingest/payload");
  const { DEFAULT_RATE_CARD } = await import("../lib/ingest/rate-card-default");
  const online = !OFFLINE && !DRY;
  const db = online ? await import("../lib/supabase/server") : null;
  const rc = online ? await import("../lib/ingest/rate-card") : null;
  const sv = online ? await import("../lib/ingest/save") : null;
  const st = online ? await import("../lib/ingest/storage") : null;

  const files = (await readdir(DOCS_DIR).catch(() => [] as string[]))
    .filter((f) => detectKind(f) !== null)
    .filter((f) => !f.includes(HOLDOUT));
  if (files.length === 0) {
    console.error(`No proposals found in ${DOCS_DIR}. See seed/README.md.`);
    process.exit(1);
  }
  files.sort((a, b) => rank(a) - rank(b));

  const rateCard = rc ? await rc.loadRateCard() : DEFAULT_RATE_CARD;
  if (OFFLINE) await mkdir(OUT_DIR, { recursive: true });
  console.log(`Rate card: ${rateCard.filter((r) => r.unit === "hour").map((r) => `${r.code}=${r.rate}`).join(", ")}\n`);

  let failures = 0;
  for (const file of files) {
    const kind = detectKind(file)!;
    const buffer = await readFile(path.join(DOCS_DIR, file));
    process.stdout.write(`→ ${file} (${kind}) … `);
    try {
      const out = await ingestBuffer(buffer, kind, rateCard);
      const job = out.processed;
      const v = job.validation;
      console.log(`${job.header.job_number} "${job.header.title}" · ${out.meta.model} · ${(out.meta.ms / 1000).toFixed(0)}s`);
      for (const s of v.sections) {
        console.log(`   ${s.ok ? "PASS" : "FAIL"} ${s.name.padEnd(28)} lines ${fmt(s.leaf_sum)}  declared ${fmt(s.bom_total ?? s.summary_total)}${s.delta_vs_bom ? `  Δ ${s.delta_vs_bom.toFixed(2)}` : ""}${s.parent_mismatches.length ? `  (${s.parent_mismatches.length} roll-up mismatches)` : ""}`);
        for (const m of s.parent_mismatches) console.log(`        ↳ ${m.description}: ${fmt(m.total)} vs children ${fmt(m.children_sum)}`);
      }
      console.log(`   ${v.subtotal.ok ? "PASS" : "FAIL"} subtotal ex GST            sections ${fmt(v.subtotal.sections_sum)}  declared ${fmt(v.subtotal.declared)}`);
      for (const m of v.messages) console.log(`   ! ${m}`);

      const hourLines = job.lines.filter((l) => l.hours !== null);
      if (hourLines.length) {
        const byActivity = new Map<string, { hours: number; n: number }>();
        for (const l of hourLines) {
          const e = byActivity.get(l.activity!) ?? { hours: 0, n: 0 };
          e.hours += l.hours!;
          e.n += 1;
          byActivity.set(l.activity!, e);
        }
        console.log(`   labour hours derived on ${hourLines.length} lines: ` + [...byActivity].map(([a, e]) => `${a} ${e.hours.toFixed(2)}h/${e.n}`).join(", "));
        if (job.header.job_number === "6570" && kind === "docx") {
          console.log("   6570 per-item hours:");
          for (const l of hourLines) console.log(`      ${l.activity!.padEnd(16)} ${String(l.hours).padStart(6)} h  ${fmt(l.total)}  ${l.description}`);
        }
      }

      if (DRY) continue;
      if (OFFLINE) {
        const outFile = path.join(OUT_DIR, file.replace(/\.(pdf|docx)$/i, "") + ".json");
        await writeFile(outFile, JSON.stringify({ file, kind, validation: v, meta: out.meta, raw: out.raw, processed: job, payload: buildSavePayload(job) }, null, 2));
        console.log(`   → wrote ${path.relative(process.cwd(), outFile)}${v.ok ? "" : " (does not reconcile)"}\n`);
        continue;
      }
      if (!v.ok && !FORCE) {
        failures += 1;
        console.log("   ✗ not saved (does not reconcile). Re-run with --force to save anyway.\n");
        continue;
      }
      const storagePath = await st!.uploadDocument(buffer, file, kind === "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
      const { data: doc, error } = await db!.supabaseAdmin()
        .from("documents")
        .insert({ kind, storage_path: storagePath, file_name: file, status: "extracted", extraction: { raw: out.raw, processed: job, meta: out.meta }, validation: v })
        .select("id")
        .single();
      if (error || !doc) throw new Error(error?.message ?? "document insert failed");
      const jobId = await sv!.saveProcessedJob(job, { documentId: doc.id, isHoldout: false });
      console.log(`   ✓ saved job ${jobId}\n`);
    } catch (e) {
      failures += 1;
      console.log(`\n   ✗ ${e instanceof Error ? e.message : String(e)}\n`);
    }
  }
  if (failures) {
    console.log(`${failures} document(s) not saved.`);
    process.exit(1);
  }
}

function rank(file: string): number {
  const i = ORDER.findIndex((k) => file.includes(k));
  return i === -1 ? 99 : i;
}
function fmt(n: number | null | undefined): string {
  return typeof n === "number" ? n.toFixed(2).padStart(11) : "        n/a";
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
