import { CheckCircle2, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatAud } from "@/lib/utils";
import type { ValidationReport } from "@/lib/ingest/types";

export function ValidationReportView({ report }: { report: ValidationReport }) {
  return (
    <div className="space-y-3 text-sm">
      <div className="flex items-center gap-2">
        {report.ok ? <CheckCircle2 className="size-5 text-emerald-600" /> : <XCircle className="size-5 text-destructive" />}
        <span className="font-medium">
          {report.ok
            ? `Reconciles to ${formatAud(report.subtotal.declared)} ex GST`
            : "Does not reconcile — review before saving"}
        </span>
      </div>
      <ul className="divide-y rounded-md border">
        {report.sections.map((s) => (
          <li key={s.ref} className="flex items-center justify-between gap-3 px-3 py-2">
            <span>
              {s.name}
              {s.parent_mismatches.length > 0 && (
                <span className="ml-2 text-xs text-muted-foreground">{s.parent_mismatches.length} roll-up mismatch(es)</span>
              )}
            </span>
            <span className="flex items-center gap-3 font-mono text-xs">
              <span>{formatAud(s.leaf_sum)}</span>
              {s.delta_vs_bom !== null && s.delta_vs_bom !== 0 && <span className="text-destructive">Δ {s.delta_vs_bom.toFixed(2)}</span>}
              <Badge variant={s.ok ? "success" : "destructive"}>{s.ok ? "pass" : "fail"}</Badge>
            </span>
          </li>
        ))}
        <li className="flex items-center justify-between gap-3 px-3 py-2 font-medium">
          <span>Subtotal ex GST</span>
          <span className="flex items-center gap-3 font-mono text-xs">
            <span>{formatAud(report.subtotal.sections_sum)}</span>
            {report.subtotal.delta !== null && report.subtotal.delta !== 0 && <span className="text-destructive">Δ {report.subtotal.delta.toFixed(2)}</span>}
            <Badge variant={report.subtotal.ok ? "success" : "destructive"}>{report.subtotal.ok ? "pass" : "fail"}</Badge>
          </span>
        </li>
        <li className="flex items-center justify-between gap-3 px-3 py-2">
          <span>GST 10%</span>
          <span className="flex items-center gap-3 font-mono text-xs">
            <span>{formatAud(report.gst.declared)}</span>
            <Badge variant={report.gst.ok ? "success" : "destructive"}>{report.gst.ok ? "pass" : "fail"}</Badge>
          </span>
        </li>
      </ul>
      {report.messages.length > 0 && (
        <ul className="list-disc space-y-1 pl-5 text-destructive">
          {report.messages.map((m, i) => (
            <li key={i}>{m}</li>
          ))}
        </ul>
      )}
      <p className="text-xs text-muted-foreground">
        Tolerance: ±{formatAud(report.tolerance.line)} per roll-up, ±{formatAud(report.tolerance.section)} per section and subtotal.
      </p>
    </div>
  );
}
