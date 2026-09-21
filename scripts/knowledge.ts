/** Print the derived knowledge layer from seed/out (no database). */
import { jobsFromSeedOut } from "../lib/knowledge/seed-context";
import { derivePriceBook, deriveLabourStandards, deriveSectionProfiles } from "../lib/knowledge/derive";

const jobs = jobsFromSeedOut();
console.log("jobs:", jobs.map((j) => `${j.job_number}${j.is_holdout ? " (holdout)" : ""}`).join(", "));
const parts = derivePriceBook(jobs);
console.log(`\nPRICE BOOK: ${parts.length} parts`);
for (const p of parts.slice(0, 40)) console.log(`  ${p.part_number.padEnd(22)} ${String(p.last_price).padStart(9)}  x${p.times_used}  ${p.category.padEnd(22)} ${p.description.slice(0, 50)}`);
const std = deriveLabourStandards(jobs);
console.log(`\nLABOUR STANDARDS: ${std.length}`);
for (const s of std.filter((s) => s.part_number)) console.log(`  ${(s.part_number ?? "").padEnd(22)} ${s.activity.padEnd(16)} ${s.hours ? s.hours + " h" : "$" + s.amount}  n=${s.sample_count}`);
console.log("  -- category medians --");
for (const s of std.filter((s) => !s.part_number)) console.log(`  ${(s.category ?? "").padEnd(22)} ${s.activity.padEnd(16)} ${s.hours ? s.hours + " h" : "$" + s.amount}  n=${s.sample_count}`);
const prof = deriveSectionProfiles(jobs);
console.log(`\nSECTION PROFILES: ${prof.length}`);
for (const p of prof) console.log(`  ${p.job_number} ${p.section_name.padEnd(26)} eq ${String(p.equipment_value).padStart(9)} cab ${String(p.cabling).padStart(8)} cons ${String(p.cons).padStart(7)} frt ${String(p.freight).padStart(6)} svc ${String(p.services).padStart(9)}  ${Object.entries(p.activities).map(([k, v]) => `${k}:${v.hours ?? "$" + v.amount}`).join(" ")}`);
