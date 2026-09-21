import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SpecEditor } from "@/components/estimate/spec-editor";
import { DraftEditor } from "@/components/estimate/draft-editor";
import { HowBuilt } from "@/components/estimate/how-built";
import { CompareView } from "@/components/estimate/compare-view";
import { JobText } from "@/components/ingest/job-text";
import { getEstimate } from "@/lib/estimates/server";
import { loadJobs } from "@/lib/knowledge/from-db";
import { supabaseAdmin } from "@/lib/supabase/server";
import { compareDraft } from "@/lib/draft/compare";

export const metadata = { title: "Estimate" };
// Draft generation runs three Claude calls from a server action on this page.
export const maxDuration = 300;

export default async function EstimatePage({ params }: PageProps<"/estimates/[id]">) {
  const { id } = await params;
  const est = await getEstimate(id);
  if (!est || !est.spec) notFound();

  const { data: holdouts } = await supabaseAdmin().from("jobs").select("job_number").eq("is_holdout", true).eq("status", "active").order("job_number");
  const holdoutOptions = [...new Set((holdouts ?? []).map((h) => h.job_number))];
  const compareJob = est.draft && est.compare_job_number ? (await loadJobs({ includeHoldout: true, jobNumbers: [est.compare_job_number] })).find((j) => j.is_holdout) ?? null : null;
  const cmp = est.draft && compareJob ? compareDraft(est.draft, compareJob) : null;

  return (
    <>
      <PageHeader title={est.spec.title || "Estimate"} description={est.spec.summary} />
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Brief</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">{est.brief_text}</CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Parsed spec</CardTitle>
            <CardDescription>What Claude read from the brief. Edit anything, then generate the draft. Quantities and prices are computed by code, never by the model.</CardDescription>
          </CardHeader>
          <CardContent>
            <SpecEditor id={id} initial={est.spec} initialMatches={est.matches ?? []} hasDraft={Boolean(est.draft)} />
          </CardContent>
        </Card>

        {est.draft && (
          <>
            {cmp && <CompareView cmp={cmp} />}
            <DraftEditor key={est.draft.generated_at} id={id} initial={est.draft} compareJobNumber={est.compare_job_number} holdoutOptions={holdoutOptions} />
            <JobText scope={est.draft.text.scope_paragraphs.join("\n\n")} assumptions={est.draft.text.assumptions} exclusions={est.draft.text.exclusions} />
            <HowBuilt draft={est.draft} />
          </>
        )}
      </div>
    </>
  );
}
