import { NextResponse } from "next/server";
import { getEstimate } from "@/lib/estimates/server";

function csvCell(v: string | number | null): string {
  const s = v === null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** CSV in Primo's BOM column order: Item, Part, Quantity, Price Each, Price Total (one block per section). */
export async function GET(_req: Request, ctx: RouteContext<"/api/estimates/[id]/csv">) {
  const { id } = await ctx.params;
  const est = await getEstimate(id);
  if (!est?.draft) return NextResponse.json({ error: "No draft" }, { status: 404 });
  const rows: string[] = ["Item,Part,Quantity,Price Each,Price Total"];
  for (const s of est.draft.sections) {
    rows.push([csvCell(s.name), "", "", "", csvCell(s.totals.total.toFixed(2))].join(","));
    for (const l of s.lines) rows.push([csvCell(l.description), csvCell(l.part_number), csvCell(l.qty), csvCell(l.unit_price.toFixed(2)), csvCell(l.total.toFixed(2))].join(","));
  }
  rows.push(["Subtotal (EX GST)", "", "", "", est.draft.totals.subtotal.toFixed(2)].join(","));
  rows.push(["Total GST Portion", "", "", "", est.draft.totals.gst.toFixed(2)].join(","));
  rows.push(["Total (INC GST)", "", "", "", est.draft.totals.total.toFixed(2)].join(","));
  const name = (est.spec?.title?.trim() || "estimate").replace(/[^A-Za-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "estimate";
  return new NextResponse(rows.join("\r\n"), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${name}_BOM.csv"` } });
}
