import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BomTable } from "@/components/ingest/bom-table";
import { ValidationReportView } from "@/components/ingest/validation-report";
import { JobText } from "@/components/ingest/job-text";
import { ParamsGrid } from "@/components/ingest/params-grid";
import { orderTree, type BomSectionView } from "@/components/ingest/bom-view";
import { supabaseAdmin } from "@/lib/supabase/server";
import { formatAud } from "@/lib/utils";
import type { ProcessedJob } from "@/lib/ingest/types";
import type { ExtractedJob } from "@/lib/schemas/extraction";
import { confirmDocument, discardDocument } from "./actions";

export const metadata = { title: "Review extraction" };

type Extraction = { raw: ExtractedJob; processed: ProcessedJob; meta: { model: string; input_tokens: number; output_tokens: number; ms: number } };

function toSections(job: ProcessedJob): BomSectionView[] {
  return job.sections.map((s) => {
    const rows = job.lines
      .filter((l) => l.section_ref === s.ref)
      .map((l) => ({
        id: l.ref,
        parentId: l.parent_ref,
        sort: l.sort,
        grp: l.grp,
        code: l.code,
        partNumber: l.part_number,
        description: l.description,
        qty: l.qty,
        unitPrice: l.unit_price,
        total: l.total,
        isExisting: l.is_existing,
        activity: l.activity,
        hours: l.hours,
        rate: l.rate,
      }));
    return { id: s.ref, name: s.name, kind: s.kind, total: s.total, leafSum: s.leaf_sum, lines: orderTree(rows) };
  });
}

export default async function ReviewPage({ params }: PageProps<"/documents/[id]">) {
  const { id } = await params;
  const { data: doc } = await supabaseAdmin().from("documents").select("*").eq("id", id).single();
  if (!doc) notFound();

  if (doc.status === "failed" || !doc.extraction) {
    const v = doc.validation as { messages?: string[] } | null;
    return (
      <>
        <PageHeader title={doc.file_name} description="Extraction failed." />
        <Card>
          <CardContent className="text-sm text-destructive">{v?.messages?.join(" ") ?? "Unknown error."}</CardContent>
        </Card>
      </>
    );
  }

  const extraction = doc.extraction as unknown as Extraction;
  const job = extraction.processed;
  const sections = toSections(job);
  const labourHours = job.lines.filter((l) => l.hours !== null).reduce((a, l) => a + (l.hours ?? 0), 0);

  return (
    <>
      <PageHeader
        title={`${job.header.job_number} · ${job.header.title}`}
        description={`${doc.file_name} · ${job.header.is_expanded_export ? "expanded export" : "standard proposal"} · ${job.header.client_org ?? ""} ${job.header.site_suburb ? `· ${job.header.site_suburb}` : ""}`}
        actions={
          doc.status === "confirmed" ? (
            <Badge variant="success">Saved</Badge>
          ) : (
            <div className="flex items-center gap-2">
              <form action={discardDocument}>
                <input type="hidden" name="document_id" value={doc.id} />
                <Button type="submit" variant="ghost">Discard</Button>
              </form>
              <form action={confirmDocument} className="flex items-center gap-3">
                <input type="hidden" name="document_id" value={doc.id} />
                <label className="flex items-center gap-1 text-xs text-muted-foreground">
                  <input type="checkbox" name="is_holdout" /> holdout (exclude from matching)
                </label>
                <Button type="submit" variant={job.validation.ok ? "default" : "destructive"}>
                  {job.validation.ok ? "Confirm and save" : "Save anyway"}
                </Button>
              </form>
            </div>
          )
        }
      />

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-6">
          {sections.map((s) => (
            <Card key={s.id}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>{s.name}</span>
                  <span className="font-mono text-sm">{formatAud(s.total ?? s.leafSum)}</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <BomTable section={s} />
              </CardContent>
            </Card>
          ))}
          {job.optional_items.length > 0 && (
            <Card>
              <CardHeader><CardTitle>Optional items</CardTitle></CardHeader>
              <CardContent>
                <ul className="divide-y text-sm">
                  {job.optional_items.map((o, i) => (
                    <li key={i} className="flex justify-between gap-3 py-2">
                      <span>{o.description}{o.part_number ? <span className="ml-2 font-mono text-xs text-muted-foreground">{o.part_number}</span> : null}</span>
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
            <CardHeader>
              <CardTitle>Arithmetic check</CardTitle>
              <CardDescription>Lines → roll-ups → sections → subtotal → GST.</CardDescription>
            </CardHeader>
            <CardContent>
              <ValidationReportView report={job.validation} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Labour</CardTitle>
              <CardDescription>{job.has_labour_detail ? "Per-item labour detail present." : "No per-item labour detail (roll-ups only)."}</CardDescription>
            </CardHeader>
            <CardContent className="text-sm">
              <p>{job.lines.filter((l) => l.hours !== null).length} lines with derived hours · {labourHours.toFixed(2)} h total</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Cost drivers</CardTitle></CardHeader>
            <CardContent><ParamsGrid params={job.params as unknown as Record<string, unknown>} /></CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Extraction</CardTitle>
              <CardDescription>
                {extraction.meta.model} · {extraction.meta.input_tokens.toLocaleString()} in / {extraction.meta.output_tokens.toLocaleString()} out · {(extraction.meta.ms / 1000).toFixed(0)}s
              </CardDescription>
            </CardHeader>
            <CardContent>
              <details>
                <summary className="cursor-pointer text-sm text-muted-foreground">Raw extracted JSON</summary>
                <pre className="mt-2 max-h-[480px] overflow-auto rounded-md bg-muted p-3 text-xs">{JSON.stringify(extraction.raw, null, 2)}</pre>
              </details>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
