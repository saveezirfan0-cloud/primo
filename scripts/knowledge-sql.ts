/** Emit SQL that loads the derived knowledge tables (used when the DB is unreachable from the app environment). */
import { writeFileSync } from "node:fs";
import { jobsFromSeedOut } from "../lib/knowledge/seed-context";
import { derivePriceBook, deriveLabourStandards, deriveSectionProfiles } from "../lib/knowledge/derive";

const q = (v: unknown): string => {
  if (v === null || v === undefined) return "null";
  if (typeof v === "number") return String(v);
  if (typeof v === "boolean") return v ? "true" : "false";
  if (Array.isArray(v)) return `array[${v.map((x) => q(String(x))).join(",")}]::text[]`;
  if (typeof v === "object") return `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`;
  return `'${String(v).replace(/'/g, "''")}'`;
};

const jobs = jobsFromSeedOut();
const parts = derivePriceBook(jobs);
const std = deriveLabourStandards(jobs);
const prof = deriveSectionProfiles(jobs);
const out: string[] = [];
out.push("delete from public.labour_standards; delete from public.parts; delete from public.section_profiles;");
out.push("insert into public.parts (part_number, description, brand, category, last_price, last_seen, times_used, jobs) values");
out.push(parts.map((p) => `(${q(p.part_number)}, ${q(p.description)}, ${q(p.brand)}, ${q(p.category)}, ${p.last_price}, ${q(p.last_seen)}, ${p.times_used}, ${q(p.jobs)})`).join(",\n") + ";");
out.push("insert into public.labour_standards (part_number, category, activity, hours, amount, sample_count) values");
out.push(std.map((s) => `(${q(s.part_number)}, ${q(s.category)}, ${q(s.activity)}, ${s.hours}, ${q(s.amount)}, ${s.sample_count})`).join(",\n") + ";");
out.push("insert into public.section_profiles (job_number, job_title, section_name, section_kind, section_total, equipment_value, cabling, cons, freight, services, activities, categories) values");
out.push(prof.map((p) => `(${q(p.job_number)}, ${q(p.job_title)}, ${q(p.section_name)}, ${q(p.section_kind)}, ${p.section_total}, ${p.equipment_value}, ${p.cabling}, ${p.cons}, ${p.freight}, ${p.services}, ${q(p.activities)}, ${q(p.categories)})`).join(",\n") + ";");
writeFileSync("seed/out/knowledge.sql", out.join("\n") + "\n");
console.log(`parts ${parts.length}, standards ${std.length}, profiles ${prof.length} -> seed/out/knowledge.sql (${out.join("\n").length} bytes)`);
