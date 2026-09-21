/** Round to cents to keep floating point noise out of comparisons. */
export function cents(n: number): number {
  return Math.round(n * 100) / 100;
}

export function sum(values: Array<number | null | undefined>): number {
  let s = 0;
  for (const v of values) if (typeof v === "number" && Number.isFinite(v)) s += v;
  return cents(s);
}

export const TOLERANCE = { line: 1, section: 5 } as const;

export function within(a: number | null | undefined, b: number | null | undefined, tol: number): boolean {
  if (typeof a !== "number" || typeof b !== "number") return false;
  return Math.abs(a - b) <= tol + 1e-9;
}
