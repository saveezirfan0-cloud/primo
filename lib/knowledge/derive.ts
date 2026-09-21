import type { KJob, KLine, KSection, LabourStandard, PartRecord, SectionProfile } from "./types";
import { categorise, brandOf } from "./categories";

const NON_PARTS = new Set(["", "-", "OFE", "CUSTOM", "CABLING", "CONS", "FREIGHT", "SERVICES", "ASSEMBLY", "LABEL-COMMS"]);

export function isRealPart(partNumber: string | null | undefined): partNumber is string {
  if (!partNumber) return false;
  return !NON_PARTS.has(partNumber.trim().toUpperCase());
}

/** Custom-fabricated items are priced per category so a "custom projector pole" can be reused. */
export function isCustomPart(partNumber: string | null | undefined): boolean {
  return (partNumber ?? "").trim().toUpperCase() === "CUSTOM";
}

export function priceBookKey(partNumber: string | null | undefined, description: string): string | null {
  if (isRealPart(partNumber)) return partNumber.trim();
  if (isCustomPart(partNumber)) return `CUSTOM:${categorise(description, "CUSTOM")}`;
  return null;
}

function leaves(section: KSection): KLine[] {
  const parents = new Set(section.lines.filter((l) => l.parent_id).map((l) => l.parent_id!));
  return section.lines.filter((l) => !parents.has(l.id));
}

/** Equipment leaf lines: EQUIPMENT group, not OFE, not the section row / Equipment header. */
export function equipmentLeaves(section: KSection): KLine[] {
  return leaves(section).filter((l) => l.grp === "EQUIPMENT" && !l.is_existing && (l.total ?? 0) > 0);
}

/** Only active, non-holdout jobs feed the knowledge layer. */
export function libraryJobs(jobs: KJob[]): KJob[] {
  return jobs.filter((j) => !j.is_holdout);
}

/** Price book: latest price per part number across library jobs, with usage counts. */
export function derivePriceBook(jobs: KJob[]): PartRecord[] {
  const byPart = new Map<string, PartRecord & { _seen: string }>();
  for (const job of libraryJobs(jobs)) {
    const seen = job.issued_on ?? "0000-00-00";
    for (const section of job.sections) {
      for (const line of equipmentLeaves(section)) {
        const pn = priceBookKey(line.part_number, line.description);
        if (!pn) continue;
        const unit = line.unit_price && line.unit_price > 0 ? line.unit_price : (line.total ?? 0) / (line.qty || 1);
        const existing = byPart.get(pn);
        if (!existing) {
          byPart.set(pn, {
            part_number: pn,
            description: line.description,
            brand: brandOf(line.description),
            category: categorise(line.description, pn),
            last_price: round2(unit),
            last_seen: job.issued_on,
            times_used: 1,
            jobs: [job.job_number],
            _seen: seen,
          });
        } else {
          existing.times_used += 1;
          if (!existing.jobs.includes(job.job_number)) existing.jobs.push(job.job_number);
          if (seen >= existing._seen) {
            existing._seen = seen;
            existing.last_seen = job.issued_on;
            existing.last_price = round2(unit);
            if (line.description.length > existing.description.length) existing.description = line.description;
          }
        }
      }
    }
  }
  return [...byPart.values()].map((p) => { const { _seen, ...rest } = p; void _seen; return rest; }).sort((a, b) => b.times_used - a.times_used || a.part_number.localeCompare(b.part_number));
}

const PER_ITEM_ACTIVITIES = new Set(["INSTALL", "CABLING-INSTALL", "DE-COMM"]);

/**
 * Labour standards from jobs with per-item labour detail:
 * hours per unit per part number (INSTALL, CABLING-INSTALL), dollars per unit for DE-COMM,
 * plus per-category medians as fallback.
 */
export function deriveLabourStandards(jobs: KJob[]): LabourStandard[] {
  const perPart = new Map<string, number[]>(); // key part|activity -> hours per unit samples
  const perPartAmount = new Map<string, number[]>();
  const perCategory = new Map<string, number[]>();
  const perCategoryAmount = new Map<string, number[]>();

  for (const job of libraryJobs(jobs).filter((j) => j.has_labour_detail)) {
    for (const section of job.sections) {
      const byId = new Map(section.lines.map((l) => [l.id, l]));
      for (const line of leaves(section)) {
        if (!line.activity || !PER_ITEM_ACTIVITIES.has(line.activity)) continue;
        // skip the activity roll-up row itself (it has no parent activity row above it with the same code)
        const parent = line.parent_id ? byId.get(line.parent_id) : undefined;
        if (!parent || parent.activity !== line.activity) continue;
        const qty = line.qty > 0 ? line.qty : 1;
        const category = categorise(line.description, line.part_number);
        if (line.activity === "DE-COMM") {
          const perUnit = round2((line.total ?? 0) / qty);
          if (perUnit <= 0) continue;
          if (isRealPart(line.part_number)) push(perPartAmount, `${line.part_number.trim()}|DE-COMM`, perUnit);
          push(perCategoryAmount, `${category}|DE-COMM`, perUnit);
          continue;
        }
        if (line.hours === null || line.hours <= 0) continue;
        const perUnit = round2(line.hours / qty);
        if (isRealPart(line.part_number)) push(perPart, `${line.part_number.trim()}|${line.activity}`, perUnit);
        push(perCategory, `${category}|${line.activity}`, perUnit);
      }
    }
  }

  const out: LabourStandard[] = [];
  for (const [key, samples] of perPart) {
    const [part_number, activity] = key.split("|");
    out.push({ part_number, category: null, activity, hours: median(samples), amount: null, sample_count: samples.length });
  }
  for (const [key, samples] of perPartAmount) {
    const [part_number, activity] = key.split("|");
    out.push({ part_number, category: null, activity, hours: 0, amount: median(samples), sample_count: samples.length });
  }
  for (const [key, samples] of perCategory) {
    const [category, activity] = key.split("|");
    out.push({ part_number: null, category, activity, hours: median(samples), amount: null, sample_count: samples.length });
  }
  for (const [key, samples] of perCategoryAmount) {
    const [category, activity] = key.split("|");
    out.push({ part_number: null, category, activity, hours: 0, amount: median(samples), sample_count: samples.length });
  }
  return out;
}

/** Section profiles for every library section: roll-up values, activity hours/amounts and ratios. */
export function deriveSectionProfiles(jobs: KJob[]): SectionProfile[] {
  const out: SectionProfile[] = [];
  for (const job of libraryJobs(jobs)) {
    for (const section of job.sections) {
      const lv = leaves(section);
      const eq = equipmentLeaves(section);
      const equipment_value = round2(eq.reduce((a, l) => a + (l.total ?? 0), 0));
      const rollup = (code: string) => round2(section.lines.filter((l) => l.code === code).reduce((a, l) => a + (l.total ?? 0), 0));
      const activities: SectionProfile["activities"] = {};
      // activity roll-up rows (children of SERVICES) carry the activity dollars; hours from the roll-up row or the sum of its leaves
      const byId = new Map(section.lines.map((l) => [l.id, l]));
      for (const line of section.lines) {
        if (!line.activity) continue;
        const parent = line.parent_id ? byId.get(line.parent_id) : undefined;
        const isActivityRow = parent?.code === "SERVICES" || (parent?.activity !== line.activity && line.code === line.activity);
        if (!isActivityRow) continue;
        const kids = lv.filter((l) => isDescendant(l, line.id, byId));
        const hours = line.hours ?? (kids.length ? sumHours(kids) : null);
        activities[line.activity] = { hours, amount: round2(line.total ?? 0) };
      }
      out.push({
        job_number: job.job_number,
        job_title: job.title,
        section_name: section.name,
        section_kind: section.kind,
        section_total: round2(section.total ?? lv.reduce((a, l) => a + (l.total ?? 0), 0)),
        equipment_value,
        cabling: rollup("CABLING"),
        cons: rollup("CONS"),
        freight: rollup("FREIGHT"),
        services: rollup("SERVICES"),
        activities,
        categories: [...new Set(eq.map((l) => categorise(l.description, l.part_number)))],
      });
    }
  }
  return out;
}

function isDescendant(line: KLine, ancestorId: string, byId: Map<string, KLine>): boolean {
  let p = line.parent_id;
  let guard = 0;
  while (p && guard++ < 12) {
    if (p === ancestorId) return true;
    p = byId.get(p)?.parent_id ?? null;
  }
  return false;
}

function sumHours(lines: KLine[]): number | null {
  const withHours = lines.filter((l) => l.hours !== null);
  if (withHours.length === 0) return null;
  return round2(withHours.reduce((a, l) => a + (l.hours ?? 0), 0));
}

function push(map: Map<string, number[]>, key: string, value: number) {
  const arr = map.get(key) ?? [];
  arr.push(value);
  map.set(key, arr);
}

export function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return round2(s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2);
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Text used for embeddings and full-text matching. */
export function jobEmbeddingText(job: Pick<KJob, "title" | "room_type" | "install_type" | "params" | "scope_text" | "structure">): string {
  const params = Object.entries(job.params ?? {})
    .filter(([, v]) => v !== null && v !== undefined && !(Array.isArray(v) && v.length === 0))
    .map(([k, v]) => `${k.replace(/_/g, " ")}: ${Array.isArray(v) ? v.join(", ") : String(v)}`)
    .join("; ");
  return [job.title, `structure: ${job.structure ?? "unknown"}`, params, job.scope_text ?? ""].filter(Boolean).join("\n\n");
}
