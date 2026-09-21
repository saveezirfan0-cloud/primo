import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabaseAdmin } from "@/lib/supabase/server";
import { supabaseConfigured } from "@/lib/env";
import { formatAud } from "@/lib/utils";
import { StartButton } from "@/components/estimate/start-button";
import { startEstimate } from "../actions";

export const metadata = { title: "New Estimate" };

const DEMO_BRIEF =
  "School hall upgrade, Mount Pritchard East PS. Replace the old projector with a ~6,500 lm laser projector on a new ceiling pole; keep the existing motorised screen and add relay control. Two HDMI inputs, one at the stage and one at the rack, with auto-switching. Keep the existing speakers and amps. New DSP, 3 wireless mics (2 handheld + 1 wireless lectern gooseneck) with remote antennas, Bluetooth input in the rack. Small touch panel in the rack for control. Reuse the existing rack. Split pricing into Video / Audio / Control so the school can stage it. EWP needed. Remove DVD/CD players.";

export default async function NewEstimatePage({ searchParams }: PageProps<"/estimates/new">) {
  const sp = await searchParams;
  const error = sp.error === "short" ? "Write a few sentences describing the job." : null;
  const recent = supabaseConfigured()
    ? (await supabaseAdmin().from("estimates").select("id, brief_text, created_at, totals, compare_job_number").order("created_at", { ascending: false }).limit(8)).data ?? []
    : [];

  return (
    <>
      <PageHeader
        title="New Estimate"
        description="Describe the job in plain estimator language. The app parses it into a spec, finds the closest past jobs and drafts a priced estimate."
      />
      <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
        <Card>
          <CardHeader>
            <CardTitle>Job brief</CardTitle>
            <CardDescription>Brief → spec → matches → draft. Parsing takes about 30 seconds.</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={startEstimate} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="brief">Brief</Label>
                <Textarea id="brief" name="brief" rows={9} defaultValue={sp.demo === "1" ? DEMO_BRIEF : ""} placeholder={DEMO_BRIEF} required />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <div className="flex items-center gap-3">
                <StartButton />
                <Link href="/estimates/new?demo=1" className="text-sm text-muted-foreground underline">Use the demo brief</Link>
              </div>
            </form>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Recent estimates</CardTitle>
          </CardHeader>
          <CardContent>
            {recent.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing yet.</p>
            ) : (
              <ul className="divide-y text-sm">
                {recent.map((e) => {
                  const totals = e.totals as { subtotal?: number } | null;
                  return (
                    <li key={e.id} className="py-2">
                      <Link href={`/estimates/${e.id}`} className="block hover:underline">
                        <span className="line-clamp-2">{e.brief_text}</span>
                      </Link>
                      <span className="text-xs text-muted-foreground">
                        {new Date(e.created_at).toLocaleString("en-AU")}
                        {totals?.subtotal !== undefined && ` · ${formatAud(totals.subtotal)} ex GST`}
                        {e.compare_job_number && ` · vs ${e.compare_job_number}`}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
