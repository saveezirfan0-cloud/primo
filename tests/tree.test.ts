import { describe, expect, it } from "vitest";
import { buildSectionTree, inferTreeFromSums, leafSum, modelTreeIsConsistent } from "@/lib/ingest/tree";
import { videoExpandedWithParents, videoExpandedFlat, videoCollapsed, bundleRows, VIDEO_TOTAL, BUNDLE_TOTAL } from "./fixtures/6570-video";

function parentOf(tree: ReturnType<typeof inferTreeFromSums>, ref: string) {
  return tree.find((r) => r.ref === ref)?.parent_ref ?? null;
}

describe("tree inference (6570 expanded export)", () => {
  it("accepts the model tree when every parent equals the sum of its children", () => {
    expect(modelTreeIsConsistent(videoExpandedWithParents)).toBe(true);
    expect(leafSum(buildSectionTree(videoExpandedWithParents))).toBeCloseTo(VIDEO_TOTAL, 2);
  });

  it("rejects a model tree whose parent does not match its children", () => {
    const broken = videoExpandedWithParents.map((r) => (r.ref === "L16" ? { ...r, total: 300 } : r));
    expect(modelTreeIsConsistent(broken)).toBe(false);
  });

  it("rebuilds the same tree from sums alone", () => {
    const tree = inferTreeFromSums(videoExpandedFlat);
    for (const expected of videoExpandedWithParents) {
      expect(parentOf(tree, expected.ref), `parent of ${expected.ref}`).toBe(expected.parent_ref);
    }
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
