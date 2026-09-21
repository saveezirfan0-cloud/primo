/**
 * Re-run post-processing + validation on saved extractions (seed/out/*.json)
 * without calling Claude again. Rewrites processed/validation/payload in place.
 *   npm run reprocess
 */
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { processExtraction } from "../lib/ingest/process";
import { buildSavePayload } from "../lib/ingest/payload";
import { DEFAULT_RATE_CARD } from "../lib/ingest/rate-card-default";

const OUT_DIR = path.join(process.cwd(), "seed", "out");

async function main() {
  const files = (await readdir(OUT_DIR)).filter((f) => f.endsWith(".json"));
  for (const file of files) {
    const full = path.join(OUT_DIR, file);
    const saved = JSON.parse(await readFile(full, "utf8"));
    const processed = processExtraction(saved.raw, DEFAULT_RATE_CARD);
    const v = processed.validation;
    console.log(`${file}: ${v.ok ? "PASS" : "FAIL"}`);
    for (const s of v.sections) console.log(`   ${s.ok ? "PASS" : "FAIL"} ${s.name.padEnd(28)} lines ${s.leaf_sum.toFixed(2).padStart(11)}  declared ${(s.bom_total ?? s.summary_total ?? 0).toFixed(2).padStart(11)}${s.delta_vs_bom ? `  Δ ${s.delta_vs_bom.toFixed(2)}` : ""}${s.parent_mismatches.length ? `  (${s.parent_mismatches.length} roll-up mismatches)` : ""}`);
    for (const m of v.messages) console.log(`   ! ${m}`);
    await writeFile(full, JSON.stringify({ ...saved, processed, validation: v, payload: buildSavePayload(processed) }, null, 2));
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
