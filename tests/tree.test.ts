import { describe, expect, it } from "vitest";
import { buildSectionTree, inferTreeFromSums, leafSum, parentsReconcile, treeFromDepth } from "@/lib/ingest/tree";
import type { ExtractedLineItem } from "@/lib/schemas/extraction";
import { videoExpandedWithDepth, videoExpandedFlat, videoCollapsed, bundleRows, VIDEO_TOTAL, BUNDLE_TOTAL, EXPECTED_PARENTS } from "./fixtures/6570-video";

function parentOf(tree: ReturnType<typeof inferTreeFromSums>, ref: string) {
  return tree.find((r) => r.ref === ref)?.parent_ref ?? null;
}

describe("tree inference (6570 expanded export)", () => {
  it("builds the tree from reported depths when every parent equals the sum of its children", () => {
    const tree = treeFromDepth(videoExpandedWithDepth)!;
    expect(tree).not.toBeNull();
    expect(parentsReconcile(tree)).toBe(true);
    for (const [ref, parent] of Object.entries(EXPECTED_PARENTS)) expect(parentOf(tree, ref), `parent of ${ref}`).toBe(parent);
    expect(leafSum(buildSectionTree(videoExpandedWithDepth))).toBeCloseTo(VIDEO_TOTAL, 2);
  });

  it("falls back to sums when a depth-derived parent does not match its children", () => {
    const broken = videoExpandedWithDepth.map((r) => (r.ref === "L16" ? { ...r, total: 300 } : r));
    expect(parentsReconcile(treeFromDepth(broken)!)).toBe(false);
    expect(treeFromDepth(videoExpandedFlat)).toBeNull();
  });

  it("rebuilds the same tree from sums alone", () => {
    const tree = inferTreeFromSums(videoExpandedFlat);
    for (const [ref, parent] of Object.entries(EXPECTED_PARENTS)) expect(parentOf(tree, ref), `parent of ${ref}`).toBe(parent);
    expect(leafSum(tree)).toBeCloseTo(VIDEO_TOTAL, 2);
  });

  it("leaves a collapsed (PDF) section flat and does not nest roll-ups under each other", () => {
    const tree = inferTreeFromSums(videoCollapsed);
    expect(tree.every((r) => r.parent_ref === null)).toBe(true);
    expect(leafSum(tree)).toBeCloseTo(VIDEO_TOTAL, 2);
  });

  it("does not double count a bundle that is also broken into its parts", () => {
    const tree = inferTreeFromSums(bundleRows);
    expect(parentOf(tree, "B2")).toBe("B1");
    expect(parentOf(tree, "B3")).toBe("B1");
    expect(leafSum(tree)).toBeCloseTo(BUNDLE_TOTAL, 2);
  });
});

describe("per-unit assemblies (6570 Control cabling)", () => {
  const rows: ExtractedLineItem[] = [
    { ref: "C1", section_ref: "S3", depth: 0, grp: "CABLING", description: "Cabling", part_number: "CABLING", qty: 1, unit_price: 348.54, total: 348.54, is_rollup: true },
    { ref: "C2", section_ref: "S3", depth: 1, grp: "CABLING", description: "Cat 6A Dual Data Outlet - 20mtrs", part_number: "Assembly", qty: 2, unit_price: 108.55, total: 217.11, is_rollup: true },
    { ref: "C3", section_ref: "S3", depth: 2, grp: "CABLING", description: "Switch Grid & Cover Plate", part_number: "CLIC2032VHWE", qty: 1, unit_price: 6.25, total: 6.25, is_rollup: false },
    { ref: "C4", section_ref: "S3", depth: 2, grp: "CABLING", description: "Cat6A cable (Per M)", part_number: "NCC6AFUTPPURPLE", qty: 40, unit_price: 1.14, total: 45.76, is_rollup: false },
    { ref: "C5", section_ref: "S3", depth: 2, grp: "CABLING", description: "RJ45 connectors", part_number: "CLI30RJ45SM6AF", qty: 4, unit_price: 12.77, total: 51.08, is_rollup: false },
    { ref: "C6", section_ref: "S3", depth: 2, grp: "CABLING", description: "Mounting clip", part_number: "CLI154", qty: 1, unit_price: 1.06, total: 1.06, is_rollup: false },
    { ref: "C7", section_ref: "S3", depth: 2, grp: "CABLING", description: "Labels", part_number: "Label-Comms", qty: 4, unit_price: 1.1, total: 4.4, is_rollup: false },
    { ref: "C8", section_ref: "S3", depth: 1, grp: "CABLING", description: "Cat 6A Dual Data Outlet - 30mtrs", part_number: "Assembly", qty: 1, unit_price: 131.43, total: 131.43, is_rollup: true },
    { ref: "C9", section_ref: "S3", depth: 2, grp: "CABLING", description: "Switch Grid & Cover Plate", part_number: "CLIC2032VHWE", qty: 1, unit_price: 6.25, total: 6.25, is_rollup: false },
    { ref: "C10", section_ref: "S3", depth: 2, grp: "CABLING", description: "Cat6A cable (Per M)", part_number: "NCC6AFUTPPURPLE", qty: 60, unit_price: 1.14, total: 68.64, is_rollup: false },
    { ref: "C11", section_ref: "S3", depth: 2, grp: "CABLING", description: "RJ45 connectors", part_number: "CLI30RJ45SM6AF", qty: 4, unit_price: 12.77, total: 51.08, is_rollup: false },
    { ref: "C12", section_ref: "S3", depth: 2, grp: "CABLING", description: "Mounting clip", part_number: "CLI154", qty: 1, unit_price: 1.06, total: 1.06, is_rollup: false },
    { ref: "C13", section_ref: "S3", depth: 2, grp: "CABLING", description: "Labels", part_number: "Label-Comms", qty: 4, unit_price: 1.1, total: 4.4, is_rollup: false },
  ];

  it("accepts qty x children = total and values the assembly at its printed total", () => {
    const tree = buildSectionTree(rows);
    expect(parentOf(tree, "C2")).toBe("C1");
    expect(parentOf(tree, "C3")).toBe("C2");
    expect(parentOf(tree, "C9")).toBe("C8");
    expect(leafSum(tree)).toBeCloseTo(348.54, 2);
  });

  it("infers the same from sums when depths are missing", () => {
    const flat = rows.map((r) => ({ ...r, depth: 0 }));
    const tree = inferTreeFromSums(flat);
    expect(parentOf(tree, "C3")).toBe("C2");
    expect(parentOf(tree, "C8")).toBe("C1");
    expect(leafSum(tree)).toBeCloseTo(348.54, 2);
  });
});
