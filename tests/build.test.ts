import { describe, expect, it } from "vitest";
import { buildDraft, overheadScale } from "@/lib/draft/build";
import type { DraftContext } from "@/lib/draft/context";
import type { Spec } from "@/lib/schemas/spec";
import { derivePriceBook } from "@/lib/knowledge/derive";
import { jobFromPayload } from "@/lib/knowledge/from-payload";

describe("overheadScale", () => {
  it("keeps template hours when equipment value is within 25%", () => {
    expect(overheadScale(9000, 10000)).toBe(1);
    expect(overheadScale(12000, 10000)).toBe(1);
  });
  it("scales down/up with the equipment ratio, clamped to [0.5, 1.5]", () => {
    expect(overheadScale(5000, 10000)).toBe(0.5);
    expect(overheadScale(2000, 10000)).toBe(0.5);
    expect(overheadScale(14000, 10000)).toBe(1.4);
    expect(overheadScale(30000, 10000)).toBe(1.5);
  });
});

describe("custom items in the price book", () => {
  it("keys CUSTOM lines by category", () => {
    const sec = "s";
    const job = jobFromPayload({
      job_number: "1", title: "T", client_org: null, site_suburb: null, issued_on: "2026-01-01", structure: "sections", room_type: "hall",
      install_type: "upgrade", subtotal_ex_gst: 511.5, params: {}, scope_text: "", assumptions: [], exclusions: [], has_labour_detail: false, is_holdout: false,
      sections: [{ id: sec, name: "Video", kind: "system", sort: 0, total: 511.5 }],
      lines: [{ id: "l1", section_id: sec, parent_id: null, grp: "EQUIPMENT", code: null, part_number: "CUSTOM", description: "Custom 2200mm FlexiMount Suspended Ceiling Projector Bracket", qty: 1, unit_price: 511.5, total: 511.5, is_existing: false, activity: null, hours: null, rate: null, sort: 0 }],
    });
    const parts = derivePriceBook([job]);
    expect(parts[0]).toMatchObject({ part_number: "CUSTOM:projector_mount", category: "projector_mount", last_price: 511.5 });
  });
});

describe("buildDraft arithmetic", () => {
  const spec: Spec = {
    title: "Test PS - Hall Upgrade",
    room_type: "hall",
    install_type: "upgrade",
    sections: [{ ref: "S1", name: "Hall Upgrade - Video", kind: "system" }],
    components: [
      { ref: "C1", section_ref: "S1", category: "projector", description: "6,500 lm laser projector", qty: 3, status: "new", part_hint: "PT-VMZ61", notes: "" },
      { ref: "C2", section_ref: "S1", category: "screen", description: "Existing motorised screen", qty: 1, status: "retained", part_hint: "", notes: "" },
      { ref: "C3", section_ref: "S1", category: "media_player", description: "DVD player", qty: 2, status: "remove", part_hint: "", notes: "" },
    ],
    params: [],
    ewp_required: false,
    summary: "",
  };
  const ctx: DraftContext = {
    parts: [{ part_number: "PT-VMZ61", description: "Panasonic 6,200 lm laser projector", brand: "Panasonic", category: "projector", last_price: 5900, last_seen: "2026-08-01", times_used: 1, jobs: ["6570"] }],
    standards: [{ part_number: null, category: "projector", activity: "INSTALL", hours: 0.33, amount: null, sample_count: 3 }],
    profiles: [],
    rateCard: [{ code: "INSTALL", rate: 95.1, unit: "hour" }, { code: "DE-COMM", rate: null, unit: "item" }],
    matches: [],
    matchedJobs: [],
    labourSourceJobs: ["6570"],
  };

  it("keeps qty x unit price equal to the line total on every line (CSV consistency)", () => {
    const draft = buildDraft(spec, ctx, []);
    for (const l of draft.sections.flatMap((s) => s.lines)) {
      expect(Math.abs(l.qty * l.unit_price - l.total), `${l.description}`).toBeLessThan(0.02);
    }
    const install = draft.sections[0].lines.find((l) => l.activity === "INSTALL" && !l.is_existing)!;
    expect(install.hours).toBe(1); // 0.33 h x 3 rounded to the 0.05 h step
    expect(install.total).toBe(95.1);
    expect(install.source_job_number).toBe("6570");
  });

  it("falls back to library default ratios when the template section has no equipment value", () => {
    const withEmptyTemplate: DraftContext = {
      ...ctx,
      profiles: [{ job_number: "9999", job_title: "Empty", section_name: "Hall Upgrade - Video", section_kind: "system", section_total: 1000, equipment_value: 0, cabling: 0, cons: 0, freight: 0, services: 1000, activities: {}, categories: ["projector"] }],
    };
    const draft = buildDraft(spec, withEmptyTemplate, []);
    const cabling = draft.sections[0].lines.find((l) => l.grp === "CABLING")!;
    expect(cabling.total).toBeGreaterThan(0);
    expect(draft.warnings.some((w) => w.includes("no equipment value"))).toBe(true);
  });

  it("de-commissioning without any standard is an ai_guess with no source job", () => {
    const draft = buildDraft(spec, { ...ctx, standards: [] }, []);
    const decomm = draft.sections[0].lines.find((l) => l.activity === "DE-COMM")!;
    expect(decomm.basis).toBe("ai_guess");
    expect(decomm.source_job_number).toBeNull();
  });
});
