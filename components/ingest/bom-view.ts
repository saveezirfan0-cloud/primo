/** Display model shared by the review screen (from extraction JSON) and the job page (from DB rows). */
export type BomLineView = {
  id: string;
  parentId: string | null;
  depth: number;
  grp: string;
  code: string | null;
  partNumber: string | null;
  description: string;
  qty: number;
  unitPrice: number | null;
  total: number | null;
  isExisting: boolean;
  activity: string | null;
  hours: number | null;
  rate: number | null;
  isLeaf: boolean;
};

export type BomSectionView = {
  id: string;
  name: string;
  kind: string;
  total: number | null;
  leafSum: number;
  lines: BomLineView[];
};

/** Order rows depth-first under their parents, computing depth from parent links. */
export function orderTree<T extends { id: string; parentId: string | null; sort?: number }>(rows: T[]): Array<T & { depth: number; isLeaf: boolean }> {
  const kids = new Map<string | null, T[]>();
  for (const r of [...rows].sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0))) {
    const arr = kids.get(r.parentId) ?? [];
    arr.push(r);
    kids.set(r.parentId, arr);
  }
  const out: Array<T & { depth: number; isLeaf: boolean }> = [];
  const walk = (parent: string | null, depth: number) => {
    for (const r of kids.get(parent) ?? []) {
      out.push({ ...r, depth, isLeaf: !(kids.get(r.id)?.length) });
      walk(r.id, depth + 1);
    }
  };
  walk(null, 0);
  return out;
}
