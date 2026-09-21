import type { ExtractedLineItem } from "@/lib/schemas/extraction";
import { ACTIVITY_CODES } from "@/lib/schemas/extraction";
import { sum, TOLERANCE, within } from "./money";

/**
 * Parent/child inference for expanded exports.
 *
 * The model reports `parent_ref` when the document makes nesting obvious. We
 * only trust that tree when every parent's total equals the sum of its
 * children. Otherwise we rebuild the tree from sums alone, in document order:
 * a row is a parent when the rows that follow it add up to its total.
 */

export const ROLLUP_CODES = ["CABLING", "CONS", "FREIGHT", "SERVICES"] as const;

const ROLLUP_ALIASES: Record<string, (typeof ROLLUP_CODES)[number]> = {
  CABLING: "CABLING",
  CABLE: "CABLING",
  CONS: "CONS",
  CONSUMABLES: "CONS",
  "HARDWARE & CONSUMABLES": "CONS",
  "HARDWARE AND CONSUMABLES": "CONS",
  FREIGHT: "FREIGHT",
  "FREIGHT & LOGISTICS": "FREIGHT",
  "FREIGHT AND LOGISTICS": "FREIGHT",
  SERVICES: "SERVICES",
  LABOUR: "SERVICES",
  LABOR: "SERVICES",
};

export function norm(s: string | null | undefined): string {
  return (s ?? "")
    .toUpperCase()
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

/** CABLING / CONS / FREIGHT / SERVICES if the row is one of the four roll-ups. */
export function rollupCode(line: Pick<ExtractedLineItem, "part_number" | "description">): string | null {
  const p = norm(line.part_number);
  if (p in ROLLUP_ALIASES) return ROLLUP_ALIASES[p];
  const d = norm(line.description);
  if (d in ROLLUP_ALIASES) return ROLLUP_ALIASES[d];
  return null;
}

const ACTIVITY_ALIASES: Record<string, string> = {
  DECOMM: "DE-COMM",
  "DE COMM": "DE-COMM",
  DECOMMISSION: "DE-COMM",
  DECOMMISSIONING: "DE-COMM",
  "CABLING INSTALL": "CABLING-INSTALL",
  "CABLE INSTALL": "CABLING-INSTALL",
  "RACK BUILD": "RACK-BUILD",
  "PROJECT MANAGE": "PROJECT-MANAGE",
  "PROJECT MANAGEMENT": "PROJECT-MANAGE",
  PM: "PROJECT-MANAGE",
  "TRAVEL ACCOMM": "TRAVEL+ACCOMM",
  "TRAVEL & ACCOMM": "TRAVEL+ACCOMM",
  "TRAVEL AND ACCOMM": "TRAVEL+ACCOMM",
  "O & M": "O&M",
  OM: "O&M",
  COMMISSIONING: "COMMISSION",
  ENGINEERING: "ENGINEER",
  DOCUMENTATION: "DOCUMENT",
  PROGRAMMING: "PROGRAM",
  TRAINING: "TRAIN",
  "E-WASTE": "EWASTE",
};

/** Activity code if the row is a labour activity roll-up (INSTALL, ENGINEER, ...). */
export function activityCode(line: Pick<ExtractedLineItem, "part_number" | "description">): string | null {
  for (const raw of [line.part_number, line.description]) {
    const n = norm(raw);
    if (!n) continue;
    if ((ACTIVITY_CODES as readonly string[]).includes(n)) return n;
    if (n in ACTIVITY_ALIASES) return ACTIVITY_ALIASES[n];
    // "INSTALL - Equipment installation" style rows
    const head = n.split(/\s[-:(]\s?|:\s/)[0].trim();
    if ((ACTIVITY_CODES as readonly string[]).includes(head)) return head;
    if (head in ACTIVITY_ALIASES) return ACTIVITY_ALIASES[head];
  }
  return null;
}

export type TreeLine = ExtractedLineItem & { parent_ref: string | null };

function isCode(line: ExtractedLineItem): boolean {
  return rollupCode(line) !== null || activityCode(line) !== null;
}

/**
 * Check a model-supplied tree: every parent's total must equal the sum of its
 * direct children within the line tolerance, and every parent_ref must exist.
 */
export function modelTreeIsConsistent(lines: ExtractedLineItem[]): boolean {
  const byRef = new Map(lines.map((l) => [l.ref, l]));
  const children = new Map<string, ExtractedLineItem[]>();
  let hasLinks = false;
  for (const l of lines) {
    if (!l.parent_ref) continue;
    if (!byRef.has(l.parent_ref) || l.parent_ref === l.ref) return false;
    hasLinks = true;
    const arr = children.get(l.parent_ref) ?? [];
    arr.push(l);
    children.set(l.parent_ref, arr);
  }
  if (!hasLinks) return false;
  for (const [ref, kids] of children) {
    const parent = byRef.get(ref)!;
    if (!within(parent.total, sum(kids.map((k) => k.total)), TOLERANCE.line)) return false;
  }
  return true;
}

/**
 * Recursive-descent inference from sums. `rows` is one section in document
 * order. Returns the same rows with parent_ref filled.
 */
export function inferTreeFromSums(rows: ExtractedLineItem[]): TreeLine[] {
  const out: TreeLine[] = rows.map((r) => ({ ...r, parent_ref: null }));

  // Consume rows from `start` as children of `parentRef` until their totals
  // reach `target`. Returns the index after the last consumed row and the sum.
  function consume(start: number, target: number, parentRef: string | null, parentIsCode: boolean): { next: number; total: number; ok: boolean } {
    let i = start;
    let acc = 0;
    while (i < out.length) {
      if (within(acc, target, TOLERANCE.line)) break;
      if (acc > target + TOLERANCE.line) break;
      const row = out[i];
      // A roll-up code row can never be nested under another roll-up code row
      // (CABLING is not a child of SERVICES), and nothing nests under a leaf-like
      // equipment row with qty != 1 unless the model flagged it as a roll-up.
      if (parentIsCode && rollupCode(row) !== null) break;
      row.parent_ref = parentRef;
      i += 1;
      const kids = tryChildren(row, i);
      if (kids) i = kids.next;
      acc = sum([acc, row.total]);
    }
    return { next: i, total: acc, ok: within(acc, target, TOLERANCE.line) };
  }

  function tryChildren(row: TreeLine, start: number): { next: number } | null {
    if (typeof row.total !== "number" || row.total <= 0) return null;
    const code = isCode(row);
    if (!code && !row.is_rollup && row.qty !== 1) return null;
    if (start >= out.length) return null;
    // Save state so a failed attempt can be rolled back.
    const snapshot = out.slice(start).map((r) => r.parent_ref);
    const res = consume(start, row.total, row.ref, code);
    const count = res.next - start;
    const minChildren = code || row.is_rollup ? 1 : 2;
    if (res.ok && count >= minChildren) return { next: res.next };
    for (let k = 0; k < snapshot.length; k++) out[start + k].parent_ref = snapshot[k];
    return null;
  }

  // Top level: walk every row; nested rows are consumed by tryChildren.
  let i = 0;
  while (i < out.length) {
    const row = out[i];
    row.parent_ref = null;
    i += 1;
    const kids = tryChildren(row, i);
    if (kids) i = kids.next;
  }
  return out;
}

/** Build the tree for one section: trust the model when consistent, else infer. */
export function buildSectionTree(rows: ExtractedLineItem[]): TreeLine[] {
  if (modelTreeIsConsistent(rows)) return rows.map((r) => ({ ...r, parent_ref: r.parent_ref ?? null }));
  return inferTreeFromSums(rows);
}

export function leafSum(rows: TreeLine[]): number {
  const parents = new Set(rows.filter((r) => r.parent_ref).map((r) => r.parent_ref));
  return sum(rows.filter((r) => !parents.has(r.ref)).map((r) => r.total));
}
