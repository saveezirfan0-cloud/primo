import { describe, expect, it } from "vitest";
import { processExtraction } from "@/lib/ingest/process";
import { jobWith, videoExpandedFlat, videoCollapsed, RATE_CARD, VIDEO_TOTAL } from "./fixtures/6570-video";

describe("processExtraction + validation (6570 numbers)", () => {
  const job = processExtraction(jobWith(videoExpandedFlat), RATE_CARD);

  it("reconciles lines to the section total and subtotal", () => {
    expect(job.validation.ok).toBe(true);
    expect(job.validation.messages).toEqual([]);
    expect(job.sections[0].leaf_sum).toBeCloseTo(VIDEO_TOTAL, 2);
    expect(job.validation.subtotal.delta).toBe(0);
    expect(job.validation.gst.ok).toBe(true);
  });

  it("tags activities through the SERVICES subtree", () => {
    const byRef = new Map(job.lines.map((l) => [l.ref, l]));
    expect(byRef.get("L12")?.code).toBe("SERVICES");
    expect(byRef.get("L16")?.activity).toBe("INSTALL");
    expect(byRef.get("L17")?.activity).toBe("INSTALL");
    expect(byRef.get("L17")?.grp).toBe("SERVICES");
    expect(byRef.get("L21")?.activity).toBe("CABLING-INSTALL");
    expect(byRef.get("L6")?.grp).toBe("CABLING");
    expect(byRef.get("L2")?.is_existing).toBe(true);
    expect(job.has_labour_detail).toBe(true);
  });

  it("converts the key/value params list into typed params", () => {
    expect(job.params.room_type).toBe("hall");
    expect(job.params.staged).toBe(false);
    expect(job.params.ewp_required).toBe(true);
    expect(job.params.projector_lumens).toBe(7000);
    expect(job.params.audio_zones).toEqual(["hall", "COLA"]);
    expect(job.params.dante).toBeNull();
    expect(job.params.optional_items_count).toBe(0);
  });

  it("derives hours = total / rate when the rate fits within 1%", () => {
    const hours = Object.fromEntries(job.lines.filter((l) => l.hours !== null).map((l) => [l.ref, l.hours]));
    expect(hours).toEqual({
      L17: 0.5, // 47.55 @ 95.10
      L18: 0.6, // 57.06 @ 95.10
      L19: 2, // 190.20 @ 95.10
      L21: 2, // 20 m x 9.51 = 0.1 h/m
      L22: 0.5,
      L23: 4, // 552 @ 138
      L24: 0.75, // 103.50 @ 138
      L25: 8, // 1152 @ 144
      L26: 4, // 624 @ 156
    });
    // DE-COMM values do not divide by 95.10: stored as dollars, no hours.
    expect(job.lines.find((l) => l.ref === "L14")?.hours).toBeNull();
    expect(job.lines.find((l) => l.ref === "L15")?.hours).toBeNull();
  });

  it("flags a section whose lines do not add up to its total", () => {
    const bad = processExtraction(jobWith(videoExpandedFlat, VIDEO_TOTAL + 50), RATE_CARD);
    expect(bad.validation.ok).toBe(false);
    expect(bad.validation.sections[0].ok).toBe(false);
    expect(bad.validation.messages.join(" ")).toMatch(/Video: lines sum to/);
  });

  it("flags a roll-up that does not equal its children", () => {
    const rows = videoExpandedFlat.map((r) => (r.ref === "L9" ? { ...r, total: 160 } : r));
    const bad = processExtraction(jobWith(rows), RATE_CARD);
    expect(bad.validation.ok).toBe(false);
  });

  it("handles a collapsed PDF without labour detail", () => {
    const pdf = processExtraction(jobWith(videoCollapsed), RATE_CARD);
    expect(pdf.validation.ok).toBe(true);
    expect(pdf.has_labour_detail).toBe(false);
    expect(pdf.lines.find((l) => l.ref === "L8")?.code).toBe("SERVICES");
  });
});
