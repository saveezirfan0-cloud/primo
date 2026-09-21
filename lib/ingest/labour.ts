import type { ProcessedLine, RateCardEntry } from "./types";
import { activityCode, rollupCode } from "./tree";
import { cents } from "./money";

/**
 * Tag labour lines with Primo activity codes and derive hours from the rate
 * card. A derived `hours` is only stored when hours x rate reproduces the
 * printed dollar value within 1%.
 */

export const HOURS_TOLERANCE_PCT = 0.01;

/** Estimators quote in 0.05 h steps (0.1 h per metre, 0.25/0.5/0.75 h items, whole hours). */
function plausibleHours(h: number): boolean {
  return h > 0 && Math.abs(h * 20 - Math.round(h * 20)) < 1e-6;
}

function fits(hours: number, rate: number, total: number): boolean {
  return plausibleHours(hours) && Math.abs(hours * rate - total) <= Math.max(0.01, total * HOURS_TOLERANCE_PCT);
}

/** Walk the SERVICES subtree and propagate activity codes to descendants. */
export function tagActivities(lines: ProcessedLine[]): void {
  const byRef = new Map(lines.map((l) => [l.ref, l]));
  for (const line of lines) {
    const roll = rollupCode(line);
    if (roll) {
      line.code = roll;
      line.grp = roll as ProcessedLine["grp"];
      continue;
    }
    const act = activityCode(line);
    if (act) {
      line.code = act;
      line.activity = act;
      line.grp = "SERVICES";
    }
  }
  // Inherit group + activity from the nearest ancestor that has one.
  for (const line of lines) {
    let p = line.parent_ref ? byRef.get(line.parent_ref) : undefined;
    let depth = 0;
    while (p && depth < 10) {
      if (!line.activity && p.activity) line.activity = p.activity;
      if (p.code && (["CABLING", "CONS", "FREIGHT", "SERVICES"] as string[]).includes(p.code)) {
        line.grp = p.code as ProcessedLine["grp"];
      } else if (p.activity) {
        line.grp = "SERVICES";
      }
      p = p.parent_ref ? byRef.get(p.parent_ref) : undefined;
      depth += 1;
    }
  }
}

export function deriveHours(line: ProcessedLine, rateCard: RateCardEntry[]): void {
  if (!line.activity || !line.is_leaf) return;
  const entry = rateCard.find((r) => r.code === line.activity);
  if (!entry || entry.unit !== "hour" || !entry.rate) return;
  const rate = entry.rate;
  if (typeof line.total !== "number" || line.total <= 0) return;

  // Per-unit pricing (e.g. cable per metre at 9.51 = 0.1h) when a unit price is printed.
  let hours: number | null = null;
  if (typeof line.unit_price === "number" && line.unit_price > 0 && line.qty > 0) {
    const perUnit = Math.round((line.unit_price / rate) * 20) / 20;
    const candidate = cents(perUnit * line.qty);
    if (plausibleHours(perUnit) && fits(candidate, rate, line.total)) hours = candidate;
  }
  if (hours === null) {
    const candidate = Math.round((line.total / rate) * 20) / 20;
    if (fits(candidate, rate, line.total)) hours = candidate;
  }
  if (hours !== null) {
    line.hours = hours;
    line.rate = rate;
  }
}
