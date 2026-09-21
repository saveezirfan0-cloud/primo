import { randomUUID } from "node:crypto";
import type { Spec, SpecComponent } from "@/lib/schemas/spec";
import type { LabourStandard, PartRecord, SectionProfile } from "@/lib/knowledge/types";
import type { DraftContext } from "./context";
import type { Draft, DraftLine, DraftSection, Basis, Confidence } from "./types";
import { draftTotals, r2, sectionTotals } from "./totals";
import { categorise } from "@/lib/knowledge/categories";
import { median } from "@/lib/knowledge/derive";
import { specParams } from "@/lib/schemas/spec";

function specParamsOf(spec: Spec): Record<string, unknown> {
  return specParams(spec) as unknown as Record<string, unknown>;
}
function formatK(n: number): string {
  return `$${(n / 1000).toFixed(1)}k`;
}

/** Part chosen for a component: by Claude (from candidates) or by code. */
export type PartChoice = { component_ref: string; part_number: string };

const DEFAULT_INSTALL_HOURS = 0.6;
const DEFAULT_DECOMM_AMOUNT = 30.91;
const RETAINED_INTEGRATION_HOURS = 0.5;
const OVERHEAD_ACTIVITIES = ["RACK-BUILD", "ENGINEER", "DOCUMENT", "COMMISSION", "PROGRAM", "TRAIN", "O&M", "PROJECT-MANAGE", "WORKSHOP", "RUBBISH", "EWASTE", "PARKING", "TRAVEL+ACCOMM", "ACCESS"];
const ACTIVITY_LABELS: Record<string, string> = {
  "DE-COMM": "De-Commissioning of Existing Equipment",
  INSTALL: "Equipment Installation",
  "CABLING-INSTALL": "Cabling Installation",
  "RACK-BUILD": "Rack Build/Tidy",
  ENGINEER: "Design & Engineering",
  DOCUMENT: "Asset & On Site Documentation",
  COMMISSION: "Commissioning & Testing",
  PROGRAM: "Control & Audio Programming",
  TRAIN: "End User Training",
  "O&M": "O&M Documentation",
  "PROJECT-MANAGE": "Project Management",
  WORKSHOP: "Control Workshops",
  RUBBISH: "Rubbish Removal",
  EWASTE: "eWaste Recycling",
  PARKING: "Parking",
  "TRAVEL+ACCOMM": "Travel & Accommodation",
  ACCESS: "Access Equipment (EWP / Scissor Lift Hire)",
};

function line(partial: Omit<DraftLine, "id" | "total"> & { total?: number }): DraftLine {
  const total = partial.total ?? r2(partial.qty * partial.unit_price);
  return { id: randomUUID(), ...partial, total };
}

function rateFor(ctx: DraftContext, code: string): number | null {
  const r = ctx.rateCard.find((x) => x.code === code);
  return r && r.unit === "hour" ? r.rate : null;
}

function roundHours(h: number): number {
  return Math.max(0.05, Math.round(h * 20) / 20);
}

/** Pick the section profile that best templates a spec section: same-name from best match first, then category overlap. */
export function chooseTemplate(section: Spec["sections"][number], components: SpecComponent[], ctx: DraftContext): SectionProfile | null {
  if (ctx.profiles.length === 0) return null;
  const rank = new Map(ctx.matches.map((m, i) => [m.job_number, i]));
  const wanted = new Set(components.filter((c) => c.status !== "remove").map((c) => c.category));
  const key = normaliseSectionName(section.name);
  const scored = ctx.profiles.map((p) => {
    const jobRank = rank.has(p.job_number) ? rank.get(p.job_number)! : 99;
    const nameMatch = key && normaliseSectionName(p.section_name) === key ? 1 : 0;
    const overlap = wanted.size ? [...wanted].filter((c) => p.categories.includes(c)).length / wanted.size : 0;
    const kindMatch = p.section_kind === section.kind ? 0.2 : 0;
    const labourBonus = Object.keys(p.activities).length ? 0.3 : 0;
    const score = nameMatch * 2 + overlap + kindMatch + labourBonus - jobRank * 0.5;
    return { p, score };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored[0].p;
}

function normaliseSectionName(name: string): string {
  const n = name.toLowerCase();
  for (const k of ["video", "audio", "control", "lighting"]) if (n.includes(k)) return k;
  const m = /stage\s*(\d+)/.exec(n);
  return m ? `stage${m[1]}` : "";
}

function findPart(ctx: DraftContext, partNumber: string): PartRecord | undefined {
  const pn = partNumber.trim().toLowerCase();
  return ctx.parts.find((p) => p.part_number.toLowerCase() === pn) ?? ctx.parts.find((p) => p.part_number.toLowerCase().includes(pn) && pn.length >= 4);
}

/** Resolve a new component to a priced part. Returns the part and how it was chosen. */
export function resolvePart(c: SpecComponent, ctx: DraftContext, choices: PartChoice[]): { part: PartRecord | null; basis: Basis; confidence: Confidence; note: string } {
  const chosen = choices.find((x) => x.component_ref === c.ref && x.part_number);
  if (chosen) {
    const part = findPart(ctx, chosen.part_number);
    if (part) return { part, basis: "price_book", confidence: "high", note: `Chosen from price book (used in ${part.jobs.join(", ")})` };
  }
  if (c.part_hint) {
    const part = findPart(ctx, c.part_hint);
    if (part) return { part, basis: "price_book", confidence: "high", note: `Part hinted by the brief (used in ${part.jobs.join(", ")})` };
  }
  // best part in the category, preferring parts from matched jobs, then most used / most recent
  const matched = new Set(ctx.matches.map((m) => m.job_number));
  const inCat = ctx.parts.filter((p) => p.category === c.category);
  if (inCat.length) {
    inCat.sort((a, b) => {
      const am = a.jobs.some((j) => matched.has(j)) ? 1 : 0;
      const bm = b.jobs.some((j) => matched.has(j)) ? 1 : 0;
      return bm - am || b.times_used - a.times_used || (b.last_seen ?? "").localeCompare(a.last_seen ?? "");
    });
    const part = inCat[0];
    return { part, basis: "price_book", confidence: "medium", note: `Nearest priced ${c.category.replace(/_/g, " ")} in the price book (used in ${part.jobs.join(", ")})` };
  }
  return { part: null, basis: "ai_guess", confidence: "low", note: "No priced part of this category in the library; price needed" };
}

/** Scale factor for section overheads: template hours are scaled by the ratio of equipment value, within [0.5, 1.5]. */
export function overheadScale(draftEquipment: number, templateEquipment: number): number {
  if (templateEquipment <= 0 || draftEquipment <= 0) return 1;
  const ratio = draftEquipment / templateEquipment;
  if (ratio >= 0.75 && ratio <= 1.25) return 1;
  return Math.min(1.5, Math.max(0.5, ratio));
}

function standardFor(standards: LabourStandard[], partNumber: string | null, category: string, activity: string): { std: LabourStandard | null; level: "part" | "category" | "none" } {
  if (partNumber) {
    const s = standards.find((x) => x.part_number?.toLowerCase() === partNumber.toLowerCase() && x.activity === activity);
    if (s) return { std: s, level: "part" };
  }
  const c = standards.find((x) => !x.part_number && x.category === category && x.activity === activity);
  if (c) return { std: c, level: "category" };
  return { std: null, level: "none" };
}

/** Base unit for CONS / FREIGHT rounding (Primo quotes them in multiples of ~$110-120). */
function baseUnitOf(...values: number[]): number | null {
  for (const base of [110, 115, 120]) if (values.every((v) => v === 0 || Math.abs(v / base - Math.round(v / base)) < 0.01)) return base;
  return null;
}

export function buildDraft(spec: Spec, ctx: DraftContext, choices: PartChoice[]): Draft {
  const warnings: string[] = [];
  const sections: DraftSection[] = [];
  const ratio_sources: Draft["ratio_sources"] = [];
  const installRate = rateFor(ctx, "INSTALL") ?? 95.1;
  const cablingRate = rateFor(ctx, "CABLING-INSTALL") ?? installRate;
  const allProfiles = ctx.profiles;
  let accessPlaced = false;
  let rubbishPlaced = false;

  for (const section of spec.sections) {
    const comps = spec.components.filter((c) => c.section_ref === section.ref);
    const template = chooseTemplate(section, comps, ctx);
    const lines: DraftLine[] = [];
    const src = template?.job_number ?? null;

    // ---- Equipment ----
    for (const c of comps) {
      if (c.status === "retained") {
        lines.push(line({ section_ref: section.ref, grp: "EQUIPMENT", part_number: "OFE", description: `${c.description} (Existing)`, qty: c.qty, unit_price: 0, is_existing: true, activity: null, hours: null, rate: null, basis: "matched_job", source_job_number: src, confidence: "high", note: "Retained on site (OFE)", component_ref: c.ref }));
        continue;
      }
      if (c.status !== "new") continue;
      const { part, basis, confidence, note } = resolvePart(c, ctx, choices);
      if (part) {
        const isCustom = part.part_number.startsWith("CUSTOM:");
        lines.push(line({ section_ref: section.ref, grp: "EQUIPMENT", part_number: isCustom ? "CUSTOM" : part.part_number, description: isCustom ? `${c.description} (custom, priced as: ${part.description.slice(0, 60)})` : part.description, qty: c.qty, unit_price: part.last_price, is_existing: false, activity: null, hours: null, rate: null, basis, source_job_number: part.jobs[part.jobs.length - 1] ?? src, confidence, note: c.notes ? `${note}. ${c.notes}` : note, component_ref: c.ref }));
      } else {
        warnings.push(`${section.name}: no priced part for "${c.description}" (${c.category}); added at $0 for the estimator to price.`);
        lines.push(line({ section_ref: section.ref, grp: "EQUIPMENT", part_number: null, description: c.description, qty: c.qty, unit_price: 0, is_existing: false, activity: null, hours: null, rate: null, basis, source_job_number: null, confidence, note, component_ref: c.ref }));
      }
    }
    const equipmentValue = r2(lines.filter((l) => l.grp === "EQUIPMENT").reduce((a, l) => a + l.total, 0));

    // ---- Ratio-based materials: CABLING, CONS, FREIGHT ----
    const tmplEq = template && template.equipment_value > 0 ? template.equipment_value : null;
    const ratio = (v: number) => (tmplEq ? v / tmplEq : 0);
    const cablingRatio = template ? ratio(template.cabling) : 0.03;
    const consRatio = template ? ratio(template.cons) : 0.07;
    const freightRatio = template ? ratio(template.freight) : 0.03;
    const servicesRatio = template ? ratio(template.services) : 0.6;
    const base = template ? baseUnitOf(template.cons, template.freight) : null;
    const roundBase = (v: number) => (base ? Math.max(base, Math.round(v / base) * base) : r2(v));
    const tmplLabel = template ? `${template.job_number} · ${template.section_name}` : "library defaults";
    ratio_sources.push({ section: section.name, template: tmplLabel, cabling_ratio: r2(cablingRatio * 100) / 100, cons_ratio: r2(consRatio * 100) / 100, freight_ratio: r2(freightRatio * 100) / 100, services_ratio: r2(servicesRatio * 100) / 100 });

    const ratioNote = (what: string, r: number) => `${what} at ${(r * 100).toFixed(1)}% of section equipment value, ratio taken from ${tmplLabel}`;
    lines.push(line({ section_ref: section.ref, grp: "CABLING", part_number: "CABLING", description: "Cabling", qty: 1, unit_price: r2(equipmentValue * cablingRatio), is_existing: false, activity: null, hours: null, rate: null, basis: "ratio_estimate", source_job_number: src, confidence: "medium", note: ratioNote("Cable materials", cablingRatio), component_ref: null }));
    lines.push(line({ section_ref: section.ref, grp: "CONS", part_number: "CONS", description: "Hardware & Consumables", qty: 1, unit_price: roundBase(equipmentValue * consRatio), is_existing: false, activity: null, hours: null, rate: null, basis: "ratio_estimate", source_job_number: src, confidence: "medium", note: ratioNote("Consumables", consRatio) + (base ? `, rounded to $${base} units` : ""), component_ref: null }));
    lines.push(line({ section_ref: section.ref, grp: "FREIGHT", part_number: "FREIGHT", description: "Freight & Logistics", qty: 1, unit_price: roundBase(equipmentValue * freightRatio), is_existing: false, activity: null, hours: null, rate: null, basis: "ratio_estimate", source_job_number: src, confidence: "medium", note: ratioNote("Freight", freightRatio) + (base ? `, rounded to $${base} units` : ""), component_ref: null }));

    // ---- Labour: DE-COMM per removed item ----
    for (const c of comps.filter((x) => x.status === "remove")) {
      const { std, level } = standardFor(ctx.standards, c.part_hint || null, c.category, "DE-COMM");
      const fallback = ctx.standards.find((s) => !s.part_number && s.category === "other" && s.activity === "DE-COMM");
      const amount = std?.amount ?? fallback?.amount ?? DEFAULT_DECOMM_AMOUNT;
      const conf: Confidence = level === "part" ? "high" : level === "category" ? "medium" : "low";
      lines.push(line({ section_ref: section.ref, grp: "SERVICES", part_number: null, description: `${ACTIVITY_LABELS["DE-COMM"]}: ${c.description}`, qty: c.qty, unit_price: amount, is_existing: false, activity: "DE-COMM", hours: null, rate: null, basis: "matched_job", source_job_number: "6570", confidence: conf, note: level === "none" ? "Default de-commissioning allowance per item" : `Per-item de-commissioning amount from labour standards (${level})`, component_ref: c.ref }));
    }

    // ---- Labour: INSTALL per new item (+ small allowance for retained items being re-integrated) ----
    for (const l of lines.filter((x) => x.grp === "EQUIPMENT")) {
      const comp = comps.find((c) => c.ref === l.component_ref);
      if (!comp) continue;
      if (l.is_existing) {
        lines.push(line({ section_ref: section.ref, grp: "SERVICES", part_number: l.part_number, description: `${ACTIVITY_LABELS.INSTALL}: ${l.description}`, qty: l.qty, unit_price: r2(RETAINED_INTEGRATION_HOURS * installRate), total: r2(RETAINED_INTEGRATION_HOURS * l.qty * installRate), is_existing: true, activity: "INSTALL", hours: r2(RETAINED_INTEGRATION_HOURS * l.qty), rate: installRate, basis: "rate_card", source_job_number: "6570", confidence: "low", note: "Re-integration allowance for retained equipment (0.5 h each, as in 6570)", component_ref: comp.ref }));
        continue;
      }
      const cat = l.part_number ? categorise(l.description, l.part_number) : comp.category;
      const { std, level } = standardFor(ctx.standards, l.part_number, cat, "INSTALL");
      const perUnit = std?.hours && std.hours > 0 ? std.hours : DEFAULT_INSTALL_HOURS;
      const hours = roundHours(perUnit * l.qty);
      const conf: Confidence = level === "part" ? "high" : level === "category" ? "medium" : "low";
      lines.push(line({ section_ref: section.ref, grp: "SERVICES", part_number: l.part_number, description: `${ACTIVITY_LABELS.INSTALL}: ${l.description}`, qty: l.qty, unit_price: r2(perUnit * installRate), total: r2(hours * installRate), is_existing: false, activity: "INSTALL", hours, rate: installRate, basis: "rate_card", source_job_number: level === "none" ? null : "6570", confidence: conf, note: level === "part" ? `${perUnit} h per unit from this part's history` : level === "category" ? `${perUnit} h per unit, median for ${cat.replace(/_/g, " ")}` : `Default ${perUnit} h per unit (no history)`, component_ref: comp.ref }));
    }

    // ---- Labour: CABLING-INSTALL from the template's ratio to equipment value ----
    if (template) {
      const ci = template.activities["CABLING-INSTALL"];
      const ciAmount = ci ? ci.amount : 0;
      if (ciAmount > 0 && tmplEq) {
        const est = equipmentValue * (ciAmount / tmplEq);
        const hours = roundHours(est / cablingRate);
        lines.push(line({ section_ref: section.ref, grp: "SERVICES", part_number: null, description: ACTIVITY_LABELS["CABLING-INSTALL"], qty: 1, unit_price: r2(hours * cablingRate), total: r2(hours * cablingRate), is_existing: false, activity: "CABLING-INSTALL", hours, rate: cablingRate, basis: "ratio_estimate", source_job_number: template.job_number, confidence: "medium", note: `Cabling labour at ${((ciAmount / tmplEq) * 100).toFixed(1)}% of equipment value from ${tmplLabel}, converted to hours at the rate card`, component_ref: null }));
      }
    }

    // ---- Overheads: from the template's activities (hours x current rate when known, else the dollar amount) ----
    const hasActivityDetail = template && Object.keys(template.activities).length > 0;
    const newRack = spec.components.some((c) => c.status === "new" && c.category === "rack") || String(specParamsOf(spec).rack ?? "") === "new";
    if (hasActivityDetail && template) {
      const scale = overheadScale(equipmentValue, template.equipment_value);
      const scaleNote = scale === 1 ? "" : `, scaled ×${scale.toFixed(2)} by equipment value (${formatK(equipmentValue)} vs ${formatK(template.equipment_value)} in the template)`;
      for (const act of OVERHEAD_ACTIVITIES) {
        const a = template.activities[act];
        if (!a || a.amount <= 0) continue;
        // Rack build only applies with a new rack; a reused rack gets a tidy allowance.
        const rackFactor = act === "RACK-BUILD" ? (newRack ? 1 : 0.25) : 1;
        const isFixedCost = ["RUBBISH", "EWASTE", "PARKING", "TRAVEL+ACCOMM", "ACCESS"].includes(act);
        const factor = (isFixedCost ? 1 : scale) * rackFactor;
        if (act === "ACCESS") {
          if (!spec.ewp_required || accessPlaced) continue;
          accessPlaced = true;
        }
        if (act === "RUBBISH") {
          if (rubbishPlaced) continue;
          rubbishPlaced = true;
        }
        const rate = rateFor(ctx, act);
        const rackNote = act === "RACK-BUILD" && !newRack ? " (rack reused: 25% tidy allowance)" : "";
        if (a.hours && rate) {
          const hours = roundHours(a.hours * factor);
          lines.push(line({ section_ref: section.ref, grp: "SERVICES", part_number: null, description: ACTIVITY_LABELS[act] ?? act, qty: 1, unit_price: r2(hours * rate), total: r2(hours * rate), is_existing: false, activity: act, hours, rate, basis: "rate_card", source_job_number: template.job_number, confidence: "medium", note: `${a.hours} h in ${tmplLabel}${isFixedCost ? "" : scaleNote}${rackNote}, at the current rate card`, component_ref: null }));
        } else {
          const amount = r2(a.amount * factor);
          lines.push(line({ section_ref: section.ref, grp: "SERVICES", part_number: null, description: ACTIVITY_LABELS[act] ?? act, qty: 1, unit_price: amount, is_existing: false, activity: act, hours: null, rate: null, basis: "matched_job", source_job_number: template.job_number, confidence: "medium", note: `Dollar amount carried from ${tmplLabel}${isFixedCost ? "" : scaleNote}${rackNote}`, component_ref: null }));
        }
      }
    } else {
      // No per-activity detail on the template: one ratio-based services allowance net of what we already itemised.
      const itemised = lines.filter((l) => l.grp === "SERVICES").reduce((a, l) => a + l.total, 0);
      const est = Math.max(0, r2(equipmentValue * servicesRatio - itemised));
      if (est > 0) {
        lines.push(line({ section_ref: section.ref, grp: "SERVICES", part_number: null, description: "Engineering, commissioning, programming, documentation & project management (allowance)", qty: 1, unit_price: est, is_existing: false, activity: "ENGINEER", hours: null, rate: null, basis: "ratio_estimate", source_job_number: src, confidence: "low", note: ratioNote("Services", servicesRatio) + ", net of itemised labour", component_ref: null }));
      }
      warnings.push(`${section.name}: overheads estimated as a ratio because ${tmplLabel} has no per-activity labour detail.`);
    }

    if (spec.ewp_required && !accessPlaced) {
      const accessAmounts = allProfiles.map((p) => p.activities.ACCESS?.amount ?? 0).filter((v) => v > 0);
      if (accessAmounts.length) {
        accessPlaced = true;
        const amount = median(accessAmounts);
        lines.push(line({ section_ref: section.ref, grp: "SERVICES", part_number: null, description: ACTIVITY_LABELS.ACCESS, qty: 1, unit_price: amount, is_existing: false, activity: "ACCESS", hours: null, rate: null, basis: "matched_job", source_job_number: null, confidence: "medium", note: "Median EWP hire across library jobs", component_ref: null }));
      }
    }

    sections.push({ ref: section.ref, name: section.name, kind: section.kind, template: template ? { job_number: template.job_number, section_name: template.section_name } : null, lines, totals: sectionTotals(lines) });
  }

  return {
    sections,
    totals: draftTotals(sections),
    matches: ctx.matches,
    rate_card: ctx.rateCard.map((r) => ({ code: r.code, rate: r.rate, unit: r.unit })),
    ratio_sources,
    text: { scope_paragraphs: [], assumptions: [], exclusions: [] },
    warnings,
    generated_at: new Date().toISOString(),
  };
}
