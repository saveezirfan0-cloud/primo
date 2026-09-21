import { describe, expect, it } from "vitest";
import { buildSectionTree, inferTreeFromSums, leafSum, parentsReconcile, treeFromDepth } from "@/lib/ingest/tree";
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
