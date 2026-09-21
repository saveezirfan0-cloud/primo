import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export const metadata = { title: "New Estimate" };

const placeholder =
  "School hall upgrade. Replace the old projector with a ~6,500 lm laser projector on a new ceiling pole; keep the existing motorised screen and add relay control. Two HDMI inputs with auto-switching. New DSP, 3 wireless mics with remote antennas ...";

export default function NewEstimatePage() {
  return (
    <>
      <PageHeader
        title="New Estimate"
        description="Describe the job in plain estimator language. The app parses it into a spec, finds similar past jobs and drafts the estimate."
      />
      <Card>
        <CardHeader>
          <CardTitle>Job brief</CardTitle>
          <CardDescription>Brief → spec → matches → draft. Generation is wired up in Phase 3.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="brief">Brief</Label>
              <Textarea id="brief" name="brief" rows={8} placeholder={placeholder} />
            </div>
            <Button type="submit" disabled>
              Parse brief (coming in Phase 3)
            </Button>
          </form>
        </CardContent>
      </Card>
    </>
  );
}
