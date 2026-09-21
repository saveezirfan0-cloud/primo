import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { UploadForm } from "@/components/ingest/upload-form";

export const metadata = { title: "Upload proposal" };

export default function UploadPage() {
  return (
    <>
      <PageHeader title="Upload a proposal" description="Store the file, extract the job with Claude, check the arithmetic, then review before saving." />
      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>File</CardTitle>
            <CardDescription>Everything from “Acceptance &amp; Payment” onward is ignored. Bank and contact details are never stored.</CardDescription>
          </CardHeader>
          <CardContent>
            <UploadForm />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>What happens</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
              <li>The file is stored privately in Supabase Storage.</li>
              <li>Claude extracts the header, sections, every BOM row, optional items, scope, assumptions, exclusions and cost drivers.</li>
              <li>Code rebuilds the roll-up tree from sums, tags labour activities and derives hours from the rate card.</li>
              <li>Lines are reconciled to section totals and the subtotal. Anything that does not add up is flagged.</li>
              <li>You review the result and confirm. Same job number saves as a new revision.</li>
            </ol>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
