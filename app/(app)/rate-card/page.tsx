import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabaseConfigured } from "@/lib/env";
import { supabaseAdmin } from "@/lib/supabase/server";
import { updateRateCard } from "./actions";

export const metadata = { title: "Rate card" };

export default async function RateCardPage() {
  if (!supabaseConfigured()) return <EmptyState title="Supabase is not configured" />;
  const { data: rates, error } = await supabaseAdmin().from("rate_card").select("*").order("code");
  if (error) return <EmptyState title="Rate card unavailable">{error.message}</EmptyState>;

  return (
    <>
      <PageHeader title="Rate card" description="Hourly sell rates by labour activity. Drafts compute labour as hours × rate from this table." />
      <Card>
        <CardHeader>
          <CardTitle>Activities</CardTitle>
          <CardDescription>Rates are a hypothesis derived from job 6570 until the estimator confirms them. Leave the rate blank for activities priced per item.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={updateRateCard} className="space-y-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Label</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead className="text-right">Rate (AUD)</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(rates ?? []).map((r) => (
                  <TableRow key={r.code}>
                    <TableCell className="font-mono text-xs">
                      {r.code}
                      <input type="hidden" name="code" value={r.code} />
                    </TableCell>
                    <TableCell>{r.label}</TableCell>
                    <TableCell>
                      <select name={`unit:${r.code}`} defaultValue={r.unit} className="h-9 rounded-md border bg-transparent px-2 text-sm">
                        <option value="hour">hour</option>
                        <option value="item">item</option>
                      </select>
                    </TableCell>
                    <TableCell className="text-right">
                      <Input name={`rate:${r.code}`} defaultValue={r.rate === null ? "" : String(r.rate)} inputMode="decimal" className="ml-auto w-28 text-right font-mono" />
                    </TableCell>
                    <TableCell className="max-w-[360px] whitespace-normal text-xs text-muted-foreground">{r.notes}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Button type="submit">Save rates</Button>
          </form>
        </CardContent>
      </Card>
    </>
  );
}
