import { Fragment } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Comparison } from "@/lib/draft/compare";
import { cn, formatAud } from "@/lib/utils";

function pctBadge(pct: number | null, limit: number) {
  if (pct === null) return <Badge variant="outline">n/a</Badge>;
  const ok = Math.abs(pct) <= limit;
  return <Badge variant={ok ? "success" : "destructive"}>{pct > 0 ? "+" : ""}{pct.toFixed(1)}%</Badge>;
}

export function CompareView({ cmp }: { cmp: Comparison }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Draft vs Actual · {cmp.job_number} {cmp.job_title}</CardTitle>
        <CardDescription>Target: subtotal within ±15%, each section within ±25%. The real quote was not used to build the draft.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Section</TableHead>
              <TableHead className="text-right">Draft</TableHead>
              <TableHead className="text-right">Actual</TableHead>
              <TableHead className="text-right">Delta</TableHead>
              <TableHead className="text-right">±25%</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {cmp.sections.map((s) => (
              <Fragment key={s.name}>
                <TableRow className="font-medium">
                  <TableCell>{s.name}</TableCell>
                  <TableCell className="text-right font-mono">{formatAud(s.draft)}</TableCell>
                  <TableCell className="text-right font-mono">{formatAud(s.actual)}</TableCell>
                  <TableCell className={cn("text-right font-mono", s.delta !== null && s.delta > 0 ? "text-destructive" : "")}>{s.delta === null ? "—" : formatAud(s.delta)}</TableCell>
                  <TableCell className="text-right">{pctBadge(s.pct, 25)}</TableCell>
                </TableRow>
                {s.groups.map((g) => (
                  <TableRow key={`${s.name}-${g.grp}`} className="text-xs text-muted-foreground">
                    <TableCell className="pl-8">{g.grp}</TableCell>
                    <TableCell className="text-right font-mono">{formatAud(g.draft)}</TableCell>
                    <TableCell className="text-right font-mono">{formatAud(g.actual)}</TableCell>
                    <TableCell className="text-right font-mono">{formatAud(g.delta)}</TableCell>
                    <TableCell className="text-right">{g.pct === null ? "" : `${g.pct > 0 ? "+" : ""}${g.pct.toFixed(0)}%`}</TableCell>
                  </TableRow>
                ))}
              </Fragment>
            ))}
            <TableRow className="bg-muted/40 font-semibold">
              <TableCell>Subtotal ex GST</TableCell>
              <TableCell className="text-right font-mono">{formatAud(cmp.subtotal.draft)}</TableCell>
              <TableCell className="text-right font-mono">{formatAud(cmp.subtotal.actual)}</TableCell>
              <TableCell className="text-right font-mono">{formatAud(cmp.subtotal.delta)}</TableCell>
              <TableCell className="text-right">{pctBadge(cmp.subtotal.pct, 15)}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
        <div className="grid gap-4 text-sm sm:grid-cols-3">
          <div>
            <p className="font-medium">Labour hours</p>
            <p className="text-muted-foreground">Draft {cmp.hours.draft.toFixed(1)} h · Actual {cmp.hours.actual === null ? "not itemised in the actual quote" : `${cmp.hours.actual.toFixed(1)} h`}</p>
          </div>
          <div>
            <p className="font-medium">In the actual quote, missing from the draft ({cmp.missing.length})</p>
            <ul className="mt-1 space-y-1 text-xs text-muted-foreground">{cmp.missing.map((m, i) => <li key={i}>{m.part_number ? <span className="font-mono">{m.part_number} </span> : null}{m.description} — {formatAud(m.total)}</li>)}</ul>
          </div>
          <div>
            <p className="font-medium">In the draft, not in the actual quote ({cmp.extra.length})</p>
            <ul className="mt-1 space-y-1 text-xs text-muted-foreground">{cmp.extra.map((m, i) => <li key={i}>{m.part_number ? <span className="font-mono">{m.part_number} </span> : null}{m.description} — {formatAud(m.total)}</li>)}</ul>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
