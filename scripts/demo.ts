/**
 * End-to-end demo run without a database: brief -> spec -> matches -> draft -> text,
 * then Draft vs Actual against the 6427 holdout. Needs ANTHROPIC_API_KEY.
 *   npm run demo            (uses docs/demo-brief.md's brief)
 *   npm run demo -- --no-text
 */
import "dotenv/config";
import { config } from "dotenv";
import { writeFileSync } from "node:fs";
config({ path: ".env.local", override: false });

const brief = `School hall upgrade, Mount Pritchard East PS. Replace the old projector with a ~6,500 lm laser projector on a new ceiling pole; keep the existing motorised screen and add relay control. Two HDMI inputs, one at the stage and one at the rack, with auto-switching. Keep the existing speakers and amps. New DSP, 3 wireless mics (2 handheld + 1 wireless lectern gooseneck) with remote antennas, Bluetooth input in the rack. Small touch panel in the rack for control. Reuse the existing rack. Split pricing into Video / Audio / Control so the school can stage it. EWP needed. Remove DVD/CD players.`;

async function main() {
  const { jobsFromSeedOut } = await import("../lib/knowledge/seed-context");
  const { derivePriceBook, deriveLabourStandards, deriveSectionProfiles } = await import("../lib/knowledge/derive");
  const { DEFAULT_RATE_CARD } = await import("../lib/ingest/rate-card-default");
  const { parseBrief, generateDraft } = await import("../lib/draft/pipeline");
  const { compareDraft } = await import("../lib/draft/compare");

  const all = jobsFromSeedOut();
  const library = all.filter((j) => !j.is_holdout);
  const holdout = all.find((j) => j.job_number === "6427");
  const withText = !process.argv.includes("--no-text");

  console.log("→ parsing brief and matching…");
  const t0 = Date.now();
  const { spec, matches } = await parseBrief(brief, library, null);
  console.log(`  spec: ${spec.title} · ${spec.sections.length} sections · ${spec.components.length} components (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
  for (const s of spec.sections) {
    console.log(`  [${s.name}]`);
    for (const c of spec.components.filter((c) => c.section_ref === s.ref)) console.log(`     ${c.status.padEnd(8)} x${c.qty} ${c.category.padEnd(24)} ${c.description}${c.part_hint ? ` (hint ${c.part_hint})` : ""}`);
  }
  console.log("  params:", JSON.stringify(Object.fromEntries(spec.params.map((p) => [p.key, p.value]))));
  console.log("\nMATCHES");
  for (const m of matches) console.log(`  ${m.job_number} ${m.title.padEnd(42)} score ${m.score}  params ${m.score_params} vector ${m.score_vector} parts ${m.score_parts}\n     ${m.reasons.join(" · ")}`);

  const ctx = {
    parts: derivePriceBook(library),
    standards: deriveLabourStandards(library),
    profiles: deriveSectionProfiles(library),
    rateCard: DEFAULT_RATE_CARD,
    matches,
    matchedJobs: matches.map((m) => library.find((j) => j.job_number === m.job_number)!).filter(Boolean),
  };
  console.log("\n→ generating draft…");
  const t1 = Date.now();
  const draft = await generateDraft(spec, ctx, { withText });
  console.log(`  done in ${((Date.now() - t1) / 1000).toFixed(0)}s`);
  for (const s of draft.sections) {
    console.log(`\n== ${s.name}  (template ${s.template?.job_number} · ${s.template?.section_name})  total ${s.totals.total.toFixed(2)}`);
    for (const l of s.lines) console.log(`   ${l.grp.padEnd(9)} ${String(l.total.toFixed(2)).padStart(10)}  x${String(l.qty).padEnd(3)} ${(l.hours !== null ? `${l.hours}h` : "").padEnd(7)} ${l.basis.padEnd(14)} ${l.confidence.padEnd(6)} ${(l.part_number ?? "").padEnd(16)} ${l.description.slice(0, 70)}`);
    console.log(`   equipment ${s.totals.equipment} cabling ${s.totals.cabling} cons ${s.totals.cons} freight ${s.totals.freight} services ${s.totals.services}`);
  }
  console.log(`\nTOTALS subtotal ${draft.totals.subtotal} gst ${draft.totals.gst} total ${draft.totals.total} hours ${draft.totals.hours}`);
  if (draft.warnings.length) console.log("WARNINGS\n  " + draft.warnings.join("\n  "));
  if (withText) {
    console.log(`\nSCOPE (${draft.text.scope_paragraphs.length} paragraphs)\n  ${draft.text.scope_paragraphs.slice(0, 3).join("\n  ")}\n  …`);
    console.log(`ASSUMPTIONS ${draft.text.assumptions.length} · EXCLUSIONS ${draft.text.exclusions.length}`);
  }
  if (holdout) {
    const cmp = compareDraft(draft, holdout);
    console.log(`\nDRAFT vs ACTUAL (${cmp.job_number})`);
    for (const s of cmp.sections) {
      console.log(`  ${s.name.padEnd(26)} draft ${String(s.draft ?? "-").padStart(10)}  actual ${String(s.actual ?? "-").padStart(10)}  ${s.pct === null ? "" : `${s.pct > 0 ? "+" : ""}${s.pct}%`}`);
      for (const g of s.groups) console.log(`      ${g.grp.padEnd(10)} ${String(g.draft).padStart(10)} vs ${String(g.actual).padStart(10)}  ${g.pct === null ? "" : `${g.pct > 0 ? "+" : ""}${g.pct}%`}`);
    }
    console.log(`  SUBTOTAL ${cmp.subtotal.draft} vs ${cmp.subtotal.actual}  ${cmp.subtotal.pct > 0 ? "+" : ""}${cmp.subtotal.pct}%`);
    console.log(`  missing from draft (${cmp.missing.length}): ${cmp.missing.map((m) => `${m.part_number ?? ""} ${m.description.slice(0, 40)} $${m.total}`).join(" | ")}`);
    console.log(`  extra in draft (${cmp.extra.length}): ${cmp.extra.map((m) => `${m.part_number ?? ""} ${m.description.slice(0, 40)} $${m.total}`).join(" | ")}`);
  }
  writeFileSync("seed/out/demo-draft.json", JSON.stringify({ spec, matches, draft }, null, 2));
}
main().catch((e) => { console.error(e); process.exit(1); });
