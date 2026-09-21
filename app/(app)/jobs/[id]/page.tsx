import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BomTable } from "@/components/ingest/bom-table";
import { JobText } from "@/components/ingest/job-text";
import { ParamsGrid } from "@/components/ingest/params-grid";
import { orderTree, type BomSectionView } from "@/components/ingest/bom-view";
import { supabaseAdmin } from "@/lib/supabase/server";
import { formatAud } from "@/lib/utils";

export const metadata = { title: "Job" };

export default async function JobPage({ params }: PageProps<"/jobs/[id]">) {
  const { id } = await params;
  const db = supabaseAdmin();
  const { data: job } = await db.from("jobs").select("*").eq("id", id).single();
  if (!job) notFound();
  const [{ data: sections }, { data: optional }] = await Promise.all([
    db.from("sections").select("*").eq("job_id", id).order("sort"),
    db.from("optional_items").select("*").eq("job_id", id).order("sort"),
  ]);
  const sectionIds = (sections ?? []).map((s) => s.id);
  const { data: lines } = sectionIds.length
    ? await db.from("line_items").select("*").in("section_id", sectionIds).order("sort")
    : { data: [] };

  const views: BomSectionView[] = (sections ?? []).map((s) => {
    const rows = (lines ?? [])
      .filter((l) => l.section_id === s.id)
      .map((l) => ({
        id: l.id,
        parentId: l.parent_id,
        sort: l.sort,
        grp: l.grp,
        code: l.code,
        partNumber: l.part_number,
        description: l.description,
        qty: Number(l.qty),
        unitPrice: l.unit_price === null ? null : Number(l.unit_price),
        total: l.total === null ? null : Number(l.total),
        isExisting: l.is_existing,
        activity: l.activity,
        hours: l.hours === null ? null : Number(l.hours),
        rate: l.rate === null ? null : Number(l.rate),
      }));
    const ordered = orderTree(rows);
    const leafSum = ordered.filter((r) => r.isLeaf).reduce((a, r) => a + (r.total ?? 0), 0);
    return { id: s.id, name: s.name, kind: s.kind, total: s.total === null ? null : Number(s.total), leafSum: Math.round(leafSum * 100) / 100, lines: ordered };
  });

  const hours = (lines ?? []).filter((l) => l.hours !== null).reduce((a, l) => a + Number(l.hours), 0);

  return (
    <>
      <PageHeader
        title={`${job.job_number} · ${job.title}`}
        description={`${job.client_org ?? ""}${job.site_suburb ? ` · ${job.site_suburb}` : ""}${job.issued_on ? ` · issued ${job.issued_on}` : ""} · revision ${job.revision}`}
        actions={
          <div className="flex gap-2">
            {job.has_labour_detail && <Badge variant="secondary">labour detail</Badge>}
            {job.is_holdout && <Badge variant="outline">holdout</Badge>}
            {job.status !== "active" && <Badge variant="outline">{job.status}</Badge>}
          </div>
        }
      />
      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-6">
          {views.map((s) => (
            <Card key={s.id}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>{s.name}</span>
                  <span className="font-mono text-sm">{formatAud(s.total ?? s.leafSum)}</span>
                </CardTitle>
              </CardHeader>
              <CardContent><BomTable section={s} /></CardContent>
            </Card>
          ))}
          {(optional ?? []).length > 0 && (
            <Card>
              <CardHeader><CardTitle>Optional items</CardTitle></CardHeader>
              <CardContent>
                <ul className="divide-y text-sm">
                  {(optional ?? []).map((o) => (
                    <li key={o.id} className="flex justify-between gap-3 py-2">
                      <span>{o.description}</span>
                      <span className="font-mono">+{formatAud(o.total)}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
          <JobText scope={job.scope_text} assumptions={job.assumptions} exclusions={job.exclusions} />
        </div>
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Totals</CardTitle></CardHeader>
            <CardContent className="space-y-1 text-sm">
              <div className="flex justify-between"><span>Subtotal ex GST</span><span className="font-mono">{formatAud(job.subtotal_ex_gst)}</span></div>
              <div className="flex justify-between text-muted-foreground"><span>GST 10%</span><span className="font-mono">{formatAud(job.subtotal_ex_gst === null ? null : Number(job.subtotal_ex_gst) * 0.1)}</span></div>
              <div className="flex justify-between font-medium"><span>Total inc GST</span><span className="font-mono">{formatAud(job.subtotal_ex_gst === null ? null : Number(job.subtotal_ex_gst) * 1.1)}</span></div>
              <div className="flex justify-between pt-2 text-muted-foreground"><span>Derived labour hours</span><span className="font-mono">{hours.toFixed(2)} h</span></div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Cost drivers</CardTitle></CardHeader>
            <CardContent><ParamsGrid params={(job.params ?? {}) as Record<string, unknown>} /></CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
