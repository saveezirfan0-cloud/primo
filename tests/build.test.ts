import { describe, expect, it } from "vitest";
import { overheadScale } from "@/lib/draft/build";
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
