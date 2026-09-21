import type { DraftLine, DraftSection, SectionTotals } from "./types";

export const GST_RATE = 0.1;

export function r2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function sectionTotals(lines: DraftLine[]): SectionTotals {
  const sum = (grp: DraftLine["grp"]) => r2(lines.filter((l) => l.grp === grp).reduce((a, l) => a + l.total, 0));
  const equipment = sum("EQUIPMENT");
  const cabling = sum("CABLING");
  const cons = sum("CONS");
  const freight = sum("FREIGHT");
  const services = sum("SERVICES");
  return { equipment, cabling, cons, freight, services, total: r2(equipment + cabling + cons + freight + services) };
}

export function draftTotals(sections: DraftSection[]) {
  const subtotal = r2(sections.reduce((a, s) => a + s.totals.total, 0));
  const gst = r2(subtotal * GST_RATE);
  const hours = r2(sections.flatMap((s) => s.lines).reduce((a, l) => a + (l.hours ?? 0), 0));
  return { subtotal, gst, total: r2(subtotal + gst), hours };
}

/** Recompute a line's total from qty x unit price, or hours x rate for hourly labour. */
export function recomputeLine(line: DraftLine): DraftLine {
  if (line.hours !== null && line.rate !== null) {
    const total = r2(line.hours * line.rate);
    return { ...line, total, unit_price: line.qty > 0 ? r2(total / line.qty) : total };
  }
  return { ...line, total: r2(line.qty * line.unit_price) };
}
