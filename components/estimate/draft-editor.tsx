"use client";

import { useMemo, useState, useTransition } from "react";
import { Download, Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ProvenanceBadge } from "./provenance";
import { formatAud } from "@/lib/utils";
import type { Draft, DraftLine } from "@/lib/draft/types";
import { draftTotals, recomputeLine, sectionTotals } from "@/lib/draft/totals";
import { saveDraftAction } from "@/app/(app)/estimates/actions";

const GROUP_ORDER: DraftLine["grp"][] = ["EQUIPMENT", "CABLING", "CONS", "FREIGHT", "SERVICES"];
const GROUP_LABEL: Record<DraftLine["grp"], string> = { EQUIPMENT: "Equipment", CABLING: "Cabling", CONS: "Hardware & Consumables", FREIGHT: "Freight & Logistics", SERVICES: "Services (labour)" };

export function DraftEditor({ id, initial, compareJobNumber, holdoutOptions }: { id: string; initial: Draft; compareJobNumber: string | null; holdoutOptions: string[] }) {
  const [draft, setDraft] = useState<Draft>(initial);
  const [compare, setCompare] = useState(compareJobNumber ?? "");
  const [msg, setMsg] = useState<string | null>(null);
  const [saving, start] = useTransition();

  const totals = useMemo(() => draftTotals(draft.sections), [draft]);

  const setLine = (sectionRef: string, lineId: string, patch: Partial<DraftLine>) => {
    setDraft((d) => {
      const sections = d.sections.map((s) => {
        if (s.ref !== sectionRef) return s;
        const lines = s.lines.map((l) => (l.id === lineId ? recomputeLine({ ...l, ...patch }) : l));
        return { ...s, lines, totals: sectionTotals(lines) };
      });
      return { ...d, sections, totals: draftTotals(sections) };
    });
  };
  const removeLine = (sectionRef: string, lineId: string) =>
    setDraft((d) => {
      const sections = d.sections.map((s) => {
        if (s.ref !== sectionRef) return s;
        const lines = s.lines.filter((l) => l.id !== lineId);
        return { ...s, lines, totals: sectionTotals(lines) };
      });
      return { ...d, sections, totals: draftTotals(sections) };
    });

  const save = () =>
    start(async () => {
      const r = await saveDraftAction(id, { ...draft, totals }, compare || null);
      setMsg(r.ok ? "Saved." : r.message ?? "Save failed");
    });

  return (
    <div className="space-y-6">
      {draft.sections.map((s) => (
        <Card key={s.ref}>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>{s.name}</span>
              <span className="font-mono text-base">{formatAud(s.totals.total)}</span>
            </CardTitle>
            {s.template && <CardDescription>Ratios and overheads templated on {s.template.job_number} · {s.template.section_name}</CardDescription>}
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40%]">Item</TableHead>
                  <TableHead>Part</TableHead>
                  <TableHead className="w-20 text-right">Qty</TableHead>
                  <TableHead className="w-28 text-right">Hours</TableHead>
                  <TableHead className="w-32 text-right">Price each</TableHead>
                  <TableHead className="w-28 text-right">Total</TableHead>
                  <TableHead>Basis</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {GROUP_ORDER.flatMap((g) => {
                  const rows = s.lines.filter((l) => l.grp === g);
                  if (rows.length === 0) return [];
                  return [
                    <TableRow key={`${s.ref}-${g}`} className="bg-muted/40">
                      <TableCell colSpan={5} className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{GROUP_LABEL[g]}</TableCell>
                      <TableCell className="text-right font-mono text-xs">{formatAud(s.totals[g.toLowerCase() as keyof typeof s.totals] as number)}</TableCell>
                      <TableCell colSpan={2} />
                    </TableRow>,
                    ...rows.map((l) => (
                      <TableRow key={l.id} className={l.confidence === "low" ? "bg-amber-50/60 dark:bg-amber-950/20" : ""}>
                        <TableCell className="whitespace-normal">
                          <Input className="h-8" value={l.description} onChange={(e) => setLine(s.ref, l.id, { description: e.target.value })} />
                          {l.activity && <Badge variant="outline" className="mt-1 font-mono text-[10px]">{l.activity}</Badge>}
                          {l.is_existing && <Badge variant="outline" className="ml-1 mt-1 text-[10px]">OFE</Badge>}
                        </TableCell>
                        <TableCell className="font-mono text-xs">{l.part_number ?? ""}</TableCell>
                        <TableCell><Input className="h-8 text-right" type="number" min={0} step="1" value={l.qty} onChange={(e) => setLine(s.ref, l.id, { qty: Number(e.target.value) })} /></TableCell>
                        <TableCell>
                          {l.hours !== null && l.rate !== null ? (
                            <Input className="h-8 text-right" type="number" min={0} step="0.05" value={l.hours} onChange={(e) => setLine(s.ref, l.id, { hours: Number(e.target.value) })} title={`× ${formatAud(l.rate)}/h`} />
                          ) : (
                            <span className="block text-right text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {l.hours !== null && l.rate !== null ? (
                            <span className="block text-right font-mono text-xs text-muted-foreground">{formatAud(l.rate)}/h</span>
                          ) : (
                            <Input className="h-8 text-right" type="number" min={0} step="0.01" value={l.unit_price} onChange={(e) => setLine(s.ref, l.id, { unit_price: Number(e.target.value) })} />
                          )}
                        </TableCell>
                        <TableCell className="text-right font-mono">{formatAud(l.total)}</TableCell>
                        <TableCell><ProvenanceBadge basis={l.basis} confidence={l.confidence} source={l.source_job_number} note={l.note} /></TableCell>
                        <TableCell><button type="button" className="text-xs text-muted-foreground hover:text-destructive" onClick={() => removeLine(s.ref, l.id)}>remove</button></TableCell>
                      </TableRow>
                    )),
                  ];
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ))}

      <Card>
        <CardContent className="grid gap-4 sm:grid-cols-[1fr_auto]">
          <div className="space-y-1 text-sm">
            <div className="flex justify-between"><span>Subtotal ex GST</span><span className="font-mono">{formatAud(totals.subtotal)}</span></div>
            <div className="flex justify-between text-muted-foreground"><span>GST 10%</span><span className="font-mono">{formatAud(totals.gst)}</span></div>
            <div className="flex justify-between text-base font-semibold"><span>Total inc GST</span><span className="font-mono">{formatAud(totals.total)}</span></div>
            <div className="flex justify-between text-muted-foreground"><span>Labour hours</span><span className="font-mono">{totals.hours.toFixed(2)} h</span></div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <label className="text-xs text-muted-foreground">
              Compare against holdout job
              <select className="ml-2 h-8 rounded-md border bg-transparent px-2 text-sm" value={compare} onChange={(e) => setCompare(e.target.value)}>
                <option value="">none</option>
                {holdoutOptions.map((j) => <option key={j} value={j}>{j}</option>)}
              </select>
            </label>
            <div className="flex gap-2">
              <Button type="button" variant="outline" asChild>
                <a href={`/api/estimates/${id}/csv`} download><Download /> CSV (Primo BOM)</a>
              </Button>
              <Button type="button" onClick={save} disabled={saving}>{saving ? <Loader2 className="animate-spin" /> : <Save />} Save estimate</Button>
            </div>
            {msg && <span className="text-xs text-muted-foreground">{msg}</span>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
